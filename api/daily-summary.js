import { timingSafeEqual } from 'node:crypto';
import { emailConfig, sendEmailMessage } from './email.js';
import { supabaseConfig } from './store.js';

export function reportClock(now, timeZone = 'America/Chicago') {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export function reportSettings(env = process.env) {
  const timeZone = env.RSVP_REPORT_TIMEZONE || 'America/Chicago';
  Intl.DateTimeFormat('en-US', { timeZone }).format();
  const startDate = env.RSVP_REPORT_START_DATE || '2026-10-03';
  const endDate = env.RSVP_REPORT_END_DATE || '';
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!validDate(startDate) || !validDate(endDate) || endDate < startDate) {
    throw new Error('Set a valid RSVP_REPORT_END_DATE on or after RSVP_REPORT_START_DATE.');
  }
  return { timeZone, startDate, endDate };
}

export function reportDue(clock, settings) {
  return clock.hour === 23 && clock.date >= settings.startDate && clock.date <= settings.endDate;
}

export function buildSummaryEmail(rows, date, timeZone = 'America/Chicago') {
  const labels = { wedding: 'Wedding', reception: 'Reception', haldi: 'Haldi', pellikuthuru_pellikoduku: 'Pellikuthuru and Pellikoduku', vratham: 'Vratham' };
  const lines = rows.map(row => `${labels[row.event] || row.event}\nNew RSVP replies today: ${row.daily_replies}\nRSVP replies on the previous full day: ${row.previous_day_replies}\nCumulative RSVP replies: ${row.cumulative_replies}\nTotal people attending: ${row.attending_people}`);
  return {
    subject: `Daily RSVP summary — ${date}`,
    text: [`RSVP summary for ${date} at 11:00 PM ${timeZone}`, '', ...lines,
      '', 'Reply counts include acceptances and declines. People attending includes additional guests.',
      'Today covers midnight through 11:00 PM; later replies are included in the next report’s previous full day and cumulative counts.'].join('\n\n'),
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`;
  const provided = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  if (!process.env.CRON_SECRET || Buffer.byteLength(expected) !== Buffer.byteLength(provided)
    || !timingSafeEqual(Buffer.from(expected), Buffer.from(provided))) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  const now = new Date();
  let settings;
  try { settings = reportSettings(); } catch {
    return res.status(503).json({ error: 'Configure a valid report timezone, start date, and end date.' });
  }
  const clock = reportClock(now, settings.timeZone);
  if (!reportDue(clock, settings)) return res.status(200).json({ skipped: true });
  const config = supabaseConfig();
  if (!config.configured || !emailConfig().configured) return res.status(503).json({ error: 'Storage or email is not configured.' });
  const headers = { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' };
  const db = (path, method, body) => fetch(`${config.url}/rest/v1/${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000),
  });
  // Use the scheduled cutoff even when the scheduler invokes this a few minutes late.
  const cutoff = new Date(now);
  cutoff.setUTCMinutes(0, 0, 0);
  let claimed = false;
  let mailed = false;
  try {
    const stats = await db('rpc/rsvp_daily_summary', 'POST', { report_day: clock.date, report_zone: settings.timeZone, cutoff: cutoff.toISOString() });
    if (!stats.ok) throw new Error('Summary query failed.');
    const rows = await stats.json();
    const claim = await db('rsvp_daily_reports', 'POST', { report_date: clock.date });
    if (claim.status === 409) return res.status(200).json({ alreadyClaimed: true });
    if (!claim.ok) throw new Error('Report claim failed.');
    claimed = true;
    const result = await sendEmailMessage(buildSummaryEmail(rows, clock.date, settings.timeZone));
    if (!result.ok) throw new Error('Email failed.');
    mailed = true;
    const saved = await db(`rsvp_daily_reports?report_date=eq.${clock.date}`, 'PATCH', { sent_at: new Date().toISOString() });
    if (!saved.ok) throw new Error('Report status failed.');
    return res.status(200).json({ sent: true });
  } catch {
    if (claimed && !mailed) {
      try { await db(`rsvp_daily_reports?report_date=eq.${clock.date}`, 'DELETE'); } catch { /* Leave claim for operator review. */ }
    }
    return res.status(503).json({ error: 'Daily summary failed. Check function logs and report delivery before retrying.' });
  }
}
