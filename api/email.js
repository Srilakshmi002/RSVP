import { coupleNames, wedding } from '../src/config.js';

export function emailConfig() {
  const apiKey = process.env.RESEND_API_KEY || '';
  const from = process.env.RSVP_FROM_EMAIL || '';
  const to = process.env.RSVP_NOTIFY_EMAIL || '';
  return {
    apiKey,
    from,
    to,
    configured: Boolean(apiKey && from && to),
  };
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
  const meal = attending && typeof rsvp.meal === 'string' && rsvp.meal.trim() ? rsvp.meal.trim() : 'None';
  return [
    ['Primary guest', rsvp.name || ''],
    ['Email', rsvp.email || ''],
    ['Attendance', attending ? 'Attending' : 'Declined'],
    ['Additional guests', String(additional)],
    ['Total attending', String(total)],
    ["Primary guest's meal preference", meal],
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
  const subject = `RSVP for ${coupleNames()}: ${rsvp.name} (${attending ? 'Attending' : 'Declined'})`;
  const text = [`New RSVP for ${names}`, '', ...fields.map(([label, value]) => `${label}: ${value}`)].join('\n');
  const rows = fields.map(([label, value]) => (
    `<tr><th align="left" style="padding:8px 12px 8px 0;vertical-align:top;color:#6e1e2c;">${escapeHtml(label)}</th><td style="padding:8px 0;vertical-align:top;">${escapeHtml(value).replace(/\n/g, '<br>')}</td></tr>`
  )).join('');
  const html = `<div style="font-family:Georgia,serif;color:#2c1814;"><p style="margin:0 0 12px;">New RSVP for ${escapeHtml(names)}</p><table style="border-collapse:collapse;">${rows}</table></div>`;
  return { subject, text, html };
}

export async function sendRsvpEmail(rsvp) {
  const config = emailConfig();
  if (!config.configured) return { ok: false, reason: 'unconfigured', error: 'Email service is not configured.' };
  const message = buildRsvpEmail(rsvp);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `rsvp-${rsvp.id}`,
    },
    body: JSON.stringify({
      from: config.from,
      to: [config.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
    signal: AbortSignal.timeout(10000),
  });
  let payload = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const detail = payload && typeof payload.message === 'string' ? payload.message : '';
    return { ok: false, reason: 'failed', error: (detail || `Email provider returned ${response.status}`).replace(/\s+/g, ' ').slice(0, 300) };
  }
  return { ok: true, id: payload?.id || '' };
}
