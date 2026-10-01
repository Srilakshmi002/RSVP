import { timingSafeEqual } from 'node:crypto';
import { deliverNotification } from './deliver.js';
import { readJson, sendJson } from './http.js';
import { getRsvp, supabaseConfig } from './store.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function secretsMatch(provided, expected) {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const secret = process.env.NOTIFY_RETRY_SECRET || '';
  if (!secret) return sendJson(res, 503, { error: 'Notification retry is not configured.' });
  const provided = typeof req.headers['x-notify-secret'] === 'string' ? req.headers['x-notify-secret'] : '';
  if (!secretsMatch(provided, secret)) return sendJson(res, 401, { error: 'Unauthorized.' });

  const supabase = supabaseConfig();
  if (!supabase.configured) return sendJson(res, 503, { error: 'RSVP storage is not configured. Nothing was created.' });

  const parsed = readJson(req);
  if (parsed.error) return sendJson(res, 400, { error: 'Please provide a valid request.' });
  const body = parsed.body || {};
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (id && !UUID.test(id)) return sendJson(res, 400, { error: 'Please provide a valid RSVP id.' });
  if (!id && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { error: 'Please provide the guest email or RSVP id.' });

  let row;
  try {
    row = await getRsvp(id ? { id } : { email });
  } catch {
    return sendJson(res, 503, { error: 'The saved RSVP could not be loaded. Nothing new was created.' });
  }
  if (!row) return sendJson(res, 404, { error: 'No saved RSVP matches that guest. Nothing was created.' });
  if (row.notification_status === 'sent') {
    return sendJson(res, 200, { saved: true, notified: true, alreadySent: true, notification: 'sent' });
  }

  let notification;
  try {
    notification = await deliverNotification(row);
  } catch {
    return sendJson(res, 200, { saved: true, notified: false, alreadySent: false, notification: 'failed', error: 'Email delivery failed.' });
  }

  const payload = {
    saved: true,
    notified: notification.notified === true,
    alreadySent: notification.alreadySent === true,
    notification: notification.notification,
  };
  if (!payload.notified && notification.error) payload.error = notification.error;
  return sendJson(res, 200, payload);
}
