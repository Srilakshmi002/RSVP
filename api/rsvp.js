import { RECEPTION_MEAL_OPTIONS, RSVP_EVENTS } from '../shared/meals.js';
import { deliverNotification } from './deliver.js';
import { readJson, sendJson } from './http.js';
import { insertRsvp, supabaseConfig } from './store.js';

const bounded = (value, max, required = false) => typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
const POSTGRES_INT_MAX = 2147483647;

function mealPhrase() {
  return `${RECEPTION_MEAL_OPTIONS.slice(0, -1).join(', ')}, or ${RECEPTION_MEAL_OPTIONS.at(-1)}`;
}

function wholeCount(value) {
  return Number.isInteger(value) && value >= 0 && value <= POSTGRES_INT_MAX;
}

export function validateRsvp(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Please provide a valid response.';
  if (!bounded(body.name, 120, true)) return 'Please enter your full name (up to 120 characters).';
  if (!bounded(body.email, 254, true) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) return 'Please enter a valid email address.';
  if (!['yes', 'no'].includes(body.attendance)) return 'Please select whether you will attend.';
  if (body.attendance === 'yes' && !wholeCount(body.additionalGuests)) {
    return 'Please enter a whole number of additional guests.';
  }
  if (!RSVP_EVENTS.includes(body.event)) return 'Please choose the wedding or the reception.';
  if (body.event === 'reception' && body.attendance === 'yes' && !RECEPTION_MEAL_OPTIONS.includes(typeof body.meal === 'string' ? body.meal.trim() : '')) {
    return `Please choose ${mealPhrase()} for yourself.`;
  }
  if (body.dietary != null && body.dietary !== '' && !bounded(body.dietary, 500)) return 'Please shorten your dietary note.';
  if (body.message != null && !bounded(body.message, 2000)) return 'Please shorten your message.';
  if (body.message == null) return 'Please shorten your message.';
  return null;
}

function savedRecord(row, submitted) {
  return {
    id: row.id,
    created_at: row.created_at || new Date().toISOString(),
    name: row.name || submitted.name,
    email: row.email || submitted.email,
    attendance: row.attendance || submitted.attendance,
    event: row.event || submitted.event,
    meal: row.meal ?? submitted.meal,
    additional_guests: row.additional_guests ?? submitted.additional_guests,
    total_attending: row.total_attending ?? submitted.total_attending,
    guests: row.guests || submitted.guests,
    dietary: row.dietary ?? submitted.dietary,
    message: row.message ?? submitted.message,
    notification_status: row.notification_status || 'pending',
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const parsed = readJson(req);
  if (parsed.error === 'too_large') return sendJson(res, 413, { error: 'Response is too large.' });
  if (parsed.error) return sendJson(res, 400, { error: 'Please provide a valid response.' });

  const error = validateRsvp(parsed.body);
  if (error) return sendJson(res, 400, { error });

  const body = parsed.body;
  const attending = body.attendance === 'yes';
  const additionalGuests = attending ? body.additionalGuests : 0;
  const meal = body.event === 'reception' && attending ? body.meal.trim() : '';
  const record = {
    name: body.name.trim(),
    email: body.email.trim().toLowerCase(),
    event: body.event,
    attendance: body.attendance,
    meal,
    additional_guests: additionalGuests,
    total_attending: attending ? additionalGuests + 1 : 0,
    guests: attending ? [{ name: body.name.trim(), meal }] : [],
    dietary: typeof body.dietary === 'string' ? body.dietary.trim() : '',
    message: body.message.trim(),
    notification_status: 'pending',
  };

  const supabase = supabaseConfig();
  if (!supabase.configured && !supabase.partial) return sendJson(res, 200, { preview: true });
  if (supabase.partial) return sendJson(res, 503, { error: 'RSVP is temporarily unavailable. Please contact the couple.' });

  let inserted;
  try {
    inserted = await insertRsvp(record);
  } catch {
    return sendJson(res, 503, { error: 'Your response could not be saved. Please try again or contact the couple.' });
  }
  if (inserted.status === 409) {
    const eventName = body.event === 'reception' ? 'reception' : 'wedding';
    return sendJson(res, 409, { error: `We already have a ${eventName} RSVP for this email. Please contact the couple to make changes.` });
  }
  if (!inserted.ok || !inserted.row?.id) {
    return sendJson(res, 503, { error: 'Your response could not be saved. Please try again or contact the couple.' });
  }

  let notification = { notified: false, notification: 'failed' };
  try {
    notification = await deliverNotification(savedRecord(inserted.row, record));
  } catch {
    notification = { notified: false, notification: 'failed' };
  }

  return sendJson(res, 201, {
    saved: true,
    notified: notification.notified === true,
    notification: notification.notification,
  });
}
