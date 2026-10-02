import nodemailer from 'nodemailer';
import { coupleNames, wedding } from '../src/config.js';

export function emailConfig() {
  const user = (process.env.GMAIL_USER || '').trim();
  const password = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');
  const to = (process.env.RSVP_NOTIFY_EMAIL || '').trim();
  return {
    user,
    password,
    to,
    configured: Boolean(user && password && to),
  };
}

function gmailTransport(config) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
}

let transportFor = gmailTransport;

export function useMailTransport(factory) {
  transportFor = typeof factory === 'function' ? factory : gmailTransport;
}

export function formatSubmittedAt(iso, timeZone = wedding.timezone) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return `Unknown time (${timeZone || 'UTC'})`;
  let zone = timeZone || 'UTC';
  try {
    Intl.DateTimeFormat('en-US', { timeZone: zone }).format(date);
  } catch {
    zone = 'UTC';
  }
  const formatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZone: zone,
    timeZoneName: 'long',
  }).format(date);
  return `${formatted} (${zone})`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function emailFields(rsvp, submittedAt) {
  const attending = rsvp.attendance === 'yes';
  const additional = attending && Number.isInteger(rsvp.additional_guests) ? rsvp.additional_guests : 0;
  const total = attending && Number.isInteger(rsvp.total_attending) ? rsvp.total_attending : 0;
  const eventLabel = rsvp.event === 'reception' ? 'Reception' : 'Wedding';
  const meal = !attending
    ? 'None'
    : rsvp.event === 'wedding'
      ? 'Vegetarian meal served'
      : (typeof rsvp.meal === 'string' && rsvp.meal.trim() ? rsvp.meal.trim() : 'None');
  return [
    ['Event', eventLabel],
    ['Primary guest', rsvp.name || ''],
    ['Email', rsvp.email || ''],
    ['Attendance', attending ? 'Attending' : 'Declined'],
    ['Additional guests', String(additional)],
    ['Total attending', String(total)],
    ['Meal', meal],
    ['Dietary requirements', rsvp.dietary?.trim() || 'None provided'],
    ['Personal message', rsvp.message?.trim() || 'None provided'],
    ['Submitted', submittedAt],
  ];
}

export function buildRsvpEmail(rsvp, timeZone = wedding.timezone) {
  const submittedAt = formatSubmittedAt(rsvp.created_at, timeZone);
  const fields = emailFields(rsvp, submittedAt);
  const attending = rsvp.attendance === 'yes';
  const names = coupleNames('full');
  const eventLabel = rsvp.event === 'reception' ? 'Reception' : 'Wedding';
  const subject = `${eventLabel} RSVP for ${coupleNames()}: ${rsvp.name} (${attending ? 'Attending' : 'Declined'})`;
  const text = [`New ${eventLabel} RSVP for ${names}`, '', ...fields.map(([label, value]) => `${label}: ${value}`)].join('\n');
  const rows = fields.map(([label, value]) => (
    `<tr><th align="left" style="padding:8px 12px 8px 0;vertical-align:top;color:#6e1e2c;">${escapeHtml(label)}</th><td style="padding:8px 0;vertical-align:top;">${escapeHtml(value).replace(/\n/g, '<br>')}</td></tr>`
  )).join('');
  const html = `<div style="font-family:Georgia,serif;color:#2c1814;"><p style="margin:0 0 12px;">New ${escapeHtml(eventLabel)} RSVP for ${escapeHtml(names)}</p><table style="border-collapse:collapse;">${rows}</table></div>`;
  return { subject, text, html };
}

export async function sendRsvpEmail(rsvp) {
  const config = emailConfig();
  if (!config.configured) return { ok: false, reason: 'unconfigured', error: 'Email service is not configured.' };
  const message = buildRsvpEmail(rsvp);
  try {
    const transport = transportFor(config);
    const result = await transport.sendMail({
      from: config.user,
      to: config.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { ok: true, id: result?.messageId || '' };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Email delivery failed.';
    return { ok: false, reason: 'failed', error: detail.replace(/\s+/g, ' ').slice(0, 300) };
  }
}
