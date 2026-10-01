import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { validateRsvp } from '../api/rsvp.js';
import notify from '../api/notify.js';
import { buildRsvpEmail, formatSubmittedAt } from '../api/email.js';
import { MEAL_OPTIONS } from '../shared/meals.js';
import { wedding } from '../src/config.js';

const ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'RSVP_FROM_EMAIL', 'RSVP_NOTIFY_EMAIL', 'NOTIFY_RETRY_SECRET'];
const RSVP_ID = '11111111-1111-4111-8111-111111111111';

const valid = (additionalGuests = 0) => ({
  name: 'Guest One',
  email: 'guest@example.com',
  attendance: 'yes',
  meal: 'Veg',
  additionalGuests,
  dietary: 'No nuts',
  message: 'Congratulations',
});

function res() {
  return {
    code: null,
    body: null,
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function http(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

function snapshotEnv() {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(saved) {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

function useSupabase() {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
}

function useEmail() {
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.RSVP_FROM_EMAIL = 'Wedding RSVP <rsvp@example.com>';
  process.env.RSVP_NOTIFY_EMAIL = 'couple@example.com';
}

function filterMatches(stored, url) {
  if (!stored) return false;
  if (url.includes('notification_status=in.(pending,failed,unconfigured)')) {
    return ['pending', 'failed', 'unconfigured'].includes(stored.notification_status);
  }
  if (url.includes('notification_status=eq.sending')) return stored.notification_status === 'sending';
  return true;
}

function mockBackend({ insertStatus = 201, resendStatus = 200, resendBody = { id: 'email_123' }, row = null } = {}) {
  const calls = [];
  let stored = row ? { ...row } : null;
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    const target = String(url);
    const parsed = options.body ? JSON.parse(options.body) : null;
    calls.push({ url: target, method, body: parsed, headers: options.headers || {} });
    if (target.includes('api.resend.com')) return http(resendStatus, resendBody);
    if (target.includes('/rest/v1/rsvps') && method === 'POST') {
      if (insertStatus === 409) return http(409, { message: 'duplicate' });
      if (insertStatus >= 400) return http(insertStatus, { message: 'db error' });
      stored = {
        id: RSVP_ID,
        created_at: '2026-10-01T15:30:00.000Z',
        notification_status: 'pending',
        ...parsed,
      };
      return http(201, [stored]);
    }
    if (target.includes('/rest/v1/rsvps') && method === 'PATCH') {
      if (!filterMatches(stored, target)) return http(200, []);
      stored = { ...stored, ...parsed };
      return http(200, [stored]);
    }
    if (target.includes('/rest/v1/rsvps') && method === 'GET') return http(200, stored ? [stored] : []);
    if (target.includes('/rest/v1/rsvps') && method === 'DELETE') return http(204, null);
    throw new Error(`Unexpected fetch ${method} ${target}`);
  };
  return { calls, read: () => stored };
}

test('meal options are exactly Veg, Non Veg, and Both', () => {
  assert.deepEqual(MEAL_OPTIONS, ['Veg', 'Non Veg', 'Both']);
});

test('accepts every meal, attending alone, and more than four additional guests', () => {
  for (const meal of MEAL_OPTIONS) {
    assert.equal(validateRsvp({ ...valid(), meal }), null);
  }
  assert.equal(validateRsvp(valid(0)), null);
  assert.equal(validateRsvp(valid(5)), null);
  assert.equal(validateRsvp(valid(12)), null);
  assert.equal(validateRsvp({ ...valid(), attendance: 'no', meal: 'Veg', additionalGuests: 4, dietary: '' }), null);
});

test('rejects malformed RSVPs and invalid meals', () => {
  const samples = [
    null,
    [],
    {},
    { ...valid(), email: 'invalid' },
    { ...valid(), meal: '' },
    { ...valid(), meal: 'Vegetarian' },
    { ...valid(), additionalGuests: -1 },
    { ...valid(), additionalGuests: 1.5 },
    { ...valid(), additionalGuests: '4' },
    { ...valid(), additionalGuests: null },
    { ...valid(), message: 'a'.repeat(2001) },
    { ...valid(), dietary: 'a'.repeat(501) },
    { ...valid(), dietary: 12 },
  ];
  for (const body of samples) assert.ok(validateRsvp(body), JSON.stringify(body));
});

test('rejects unsupported methods, malformed JSON, and oversized bodies', async () => {
  let response = res();
  await handler({ method: 'GET', headers: {} }, response);
  assert.equal(response.code, 405);
  response = res();
  await handler({ method: 'POST', headers: {}, body: '{' }, response);
  assert.equal(response.code, 400);
  response = res();
  await handler({ method: 'POST', headers: { 'content-length': '16001' }, body: valid() }, response);
  assert.equal(response.code, 413);
});

test('preview, partial configuration, success, failure, and duplicates', async () => {
  const savedEnv = snapshotEnv();
  const originalFetch = globalThis.fetch;
  try {
    clearEnv();
    let called = false;
    globalThis.fetch = async () => { called = true; return http(500, {}); };
    let response = res();
    await handler({ method: 'POST', headers: {}, body: valid() }, response);
    assert.equal(response.code, 200);
    assert.deepEqual(response.body, { preview: true });
    assert.equal(called, false);

    process.env.SUPABASE_URL = 'https://example.supabase.co';
    response = res();
    await handler({ method: 'POST', headers: {}, body: valid() }, response);
    assert.equal(response.code, 503);
    assert.equal(called, false);

    useSupabase();
    useEmail();
    const success = mockBackend();
    response = res();
    await handler({ method: 'POST', headers: {}, body: { ...valid(), email: ' Guest@Example.com ' } }, response);
    assert.equal(response.code, 201);
    assert.equal(response.body.saved, true);
    assert.equal(response.body.notified, true);
    assert.equal(response.body.notification, 'sent');
    const insert = success.calls.find((call) => call.method === 'POST' && call.url.includes('/rest/v1/rsvps'));
    assert.equal(insert.body.email, 'guest@example.com');
    assert.equal(insert.body.meal, 'Veg');
    assert.equal(insert.body.additional_guests, 0);
    assert.equal(insert.body.total_attending, 1);
    assert.deepEqual(insert.body.guests, [{ name: 'Guest One', meal: 'Veg' }]);
    assert.equal(insert.body.dietary, 'No nuts');
    assert.equal(insert.headers.Authorization, 'Bearer test-key');
    const email = success.calls.find((call) => call.url.includes('api.resend.com'));
    assert.equal(email.headers.Authorization, 'Bearer re_test_key');
    assert.equal(email.headers['Idempotency-Key'], `rsvp-${RSVP_ID}`);
    assert.equal(email.body.to[0], 'couple@example.com');
    assert.equal(email.body.from, 'Wedding RSVP <rsvp@example.com>');
    const stamp = formatSubmittedAt('2026-10-01T15:30:00.000Z', wedding.timezone);
    for (const field of ['Primary guest: Guest One', 'Email: guest@example.com', 'Attendance: Attending', 'Additional guests: 0', 'Total attending: 1', "Primary guest's meal preference: Veg", 'Dietary requirements: No nuts', 'Personal message: Congratulations', `Submitted: ${stamp}`, `${wedding.groomFirst} ${wedding.groomLast} & ${wedding.brideFirst} ${wedding.brideLast}`]) {
      assert.ok(email.body.text.includes(field), field);
    }
    assert.equal(email.body.html.includes('<script>'), false);
    assert.equal(success.calls.some((call) => call.method === 'DELETE'), false);
    assert.equal(success.read().notification_status, 'sent');
    assert.equal(success.read().notification_id, 'email_123');
    assert.equal(JSON.stringify(response.body).includes('re_test_key'), false);

    const failed = mockBackend({ resendStatus: 422, resendBody: { message: 'Invalid <from> address' } });
    response = res();
    await handler({ method: 'POST', headers: {}, body: valid() }, response);
    assert.equal(response.code, 201);
    assert.equal(response.body.saved, true);
    assert.equal(response.body.notified, false);
    assert.equal(response.body.notification, 'failed');
    assert.equal(failed.read().notification_status, 'failed');
    assert.match(failed.read().notification_error, /Invalid/);
    assert.equal(failed.calls.filter((call) => call.method === 'POST' && call.url.includes('/rest/v1/rsvps')).length, 1);
    assert.equal(failed.calls.some((call) => call.method === 'DELETE'), false);

    delete process.env.RESEND_API_KEY;
    const unconfigured = mockBackend();
    response = res();
    await handler({ method: 'POST', headers: {}, body: valid() }, response);
    assert.deepEqual(response.body, { saved: true, notified: false, notification: 'unconfigured' });
    assert.equal(unconfigured.calls.some((call) => call.url.includes('api.resend.com')), false);
    assert.equal(unconfigured.read().notification_status, 'unconfigured');

    useEmail();
    const duplicate = mockBackend({ insertStatus: 409 });
    response = res();
    await handler({ method: 'POST', headers: {}, body: valid() }, response);
    assert.equal(response.code, 409);
    assert.equal(duplicate.calls.some((call) => call.url.includes('api.resend.com')), false);

    globalThis.fetch = async () => { throw new Error('offline'); };
    response = res();
    await handler({ method: 'POST', headers: {}, body: valid() }, response);
    assert.equal(response.code, 503);
    assert.equal(response.body.saved, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(savedEnv);
  }
});

test('decline emails report nobody attending and do not require a meal', async () => {
  const savedEnv = snapshotEnv();
  const originalFetch = globalThis.fetch;
  try {
    clearEnv();
    useSupabase();
    useEmail();
    const backend = mockBackend();
    const response = res();
    await handler({ method: 'POST', headers: {}, body: { ...valid(3), attendance: 'no', meal: 'Both', dietary: '', message: 'We will miss it' } }, response);
    assert.equal(response.body.notified, true);
    const email = backend.calls.find((call) => call.url.includes('api.resend.com'));
    assert.match(email.body.text, /Attendance: Declined/);
    assert.match(email.body.text, /Additional guests: 0/);
    assert.match(email.body.text, /Total attending: 0/);
    assert.match(email.body.text, /Primary guest's meal preference: None/);
    assert.match(email.body.text, /Personal message: We will miss it/);
    const insert = backend.calls.find((call) => call.method === 'POST' && call.url.includes('/rest/v1/rsvps'));
    assert.equal(insert.body.additional_guests, 0);
    assert.equal(insert.body.total_attending, 0);
    assert.equal(insert.body.meal, '');
    assert.equal(insert.body.guests.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(savedEnv);
  }
});

test('more than four additional guests are stored without companion details', async () => {
  const savedEnv = snapshotEnv();
  const originalFetch = globalThis.fetch;
  try {
    clearEnv();
    useSupabase();
    useEmail();
    const backend = mockBackend();
    const response = res();
    await handler({ method: 'POST', headers: {}, body: { ...valid(6), meal: 'Both' } }, response);
    assert.equal(response.code, 201);
    const insert = backend.calls.find((call) => call.method === 'POST' && call.url.includes('/rest/v1/rsvps'));
    assert.equal(insert.body.additional_guests, 6);
    assert.equal(insert.body.total_attending, 7);
    assert.equal(insert.body.meal, 'Both');
    assert.deepEqual(insert.body.guests, [{ name: 'Guest One', meal: 'Both' }]);
    const email = backend.calls.find((call) => call.url.includes('api.resend.com'));
    assert.match(email.body.text, /Additional guests: 6/);
    assert.match(email.body.text, /Total attending: 7/);
    assert.match(email.body.text, /Primary guest's meal preference: Both/);
    assert.equal(email.body.text.includes('Guest Two'), false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(savedEnv);
  }
});

test('notification email escapes guest content', () => {
  const message = buildRsvpEmail({
    id: RSVP_ID,
    created_at: '2026-10-01T15:30:00.000Z',
    name: '<Guest & Co>',
    email: 'guest@example.com',
    attendance: 'yes',
    meal: 'Non Veg',
    additional_guests: 2,
    total_attending: 3,
    dietary: '',
    message: '',
  });
  assert.match(message.html, /&lt;Guest &amp; Co&gt;/);
  assert.equal(message.html.includes('<Guest'), false);
  assert.match(message.text, /Non Veg/);
  assert.match(message.text, /America\/Chicago|UTC/);
});

test('retry authorization, missing guests, failed delivery, and duplicates', async () => {
  const savedEnv = snapshotEnv();
  const originalFetch = globalThis.fetch;
  try {
    clearEnv();
    useSupabase();
    process.env.NOTIFY_RETRY_SECRET = 'retry-secret';
    let called = false;
    globalThis.fetch = async () => { called = true; return http(500, {}); };

    let response = res();
    await notify({ method: 'POST', headers: {}, body: { email: 'guest@example.com' } }, response);
    assert.equal(response.code, 401);
    assert.equal(called, false);

    delete process.env.NOTIFY_RETRY_SECRET;
    response = res();
    await notify({ method: 'POST', headers: { 'x-notify-secret': 'retry-secret' }, body: { email: 'guest@example.com' } }, response);
    assert.equal(response.code, 503);
    assert.equal(called, false);

    process.env.NOTIFY_RETRY_SECRET = 'retry-secret';
    const missing = mockBackend({ row: null });
    response = res();
    await notify({ method: 'POST', headers: { 'x-notify-secret': 'retry-secret' }, body: { email: 'missing@example.com' } }, response);
    assert.equal(response.code, 404);
    assert.equal(missing.calls.some((call) => call.method === 'POST'), false);

    const sent = mockBackend({
      row: {
        id: RSVP_ID,
        created_at: '2026-10-01T15:30:00.000Z',
        name: 'Guest One',
        email: 'guest@example.com',
        attendance: 'yes',
        meal: 'Both',
        additional_guests: 0,
        total_attending: 1,
        guests: [{ name: 'Guest One', meal: 'Both' }],
        dietary: '',
        message: '',
        notification_status: 'sent',
      },
    });
    response = res();
    await notify({ method: 'POST', headers: { 'x-notify-secret': 'retry-secret' }, body: { id: RSVP_ID } }, response);
    assert.deepEqual(response.body, { saved: true, notified: true, alreadySent: true, notification: 'sent' });
    assert.equal(sent.calls.some((call) => call.url.includes('api.resend.com')), false);
    assert.equal(sent.calls.some((call) => call.method === 'POST'), false);

    useEmail();
    const failed = mockBackend({
      row: {
        id: RSVP_ID,
        created_at: '2026-10-01T15:30:00.000Z',
        name: 'Guest One',
        email: 'guest@example.com',
        attendance: 'yes',
        meal: 'Both',
        additional_guests: 0,
        total_attending: 1,
        guests: [{ name: 'Guest One', meal: 'Both' }],
        dietary: 'Mild spice',
        message: 'Hello',
        notification_status: 'failed',
        notification_error: 'Earlier failure',
      },
    });
    response = res();
    await notify({ method: 'POST', headers: { 'x-notify-secret': 'retry-secret' }, body: { email: 'guest@example.com' } }, response);
    assert.equal(response.body.notified, true);
    assert.equal(response.body.alreadySent, false);
    assert.equal(failed.calls.filter((call) => call.url.includes('api.resend.com')).length, 1);
    assert.equal(failed.calls.some((call) => call.method === 'POST' && call.url.endsWith('/rest/v1/rsvps')), false);
    assert.equal(failed.read().notification_status, 'sent');

    response = res();
    await notify({ method: 'POST', headers: { 'x-notify-secret': 'retry-secret' }, body: { email: 'guest@example.com' } }, response);
    assert.equal(response.body.alreadySent, true);
    assert.equal(failed.calls.filter((call) => call.url.includes('api.resend.com')).length, 1);

    delete process.env.RSVP_NOTIFY_EMAIL;
    const pending = mockBackend({
      row: {
        id: RSVP_ID,
        created_at: '2026-10-01T15:30:00.000Z',
        name: 'Guest One',
        email: 'guest@example.com',
        attendance: 'no',
        meal: '',
        additional_guests: 0,
        total_attending: 0,
        guests: [],
        dietary: '',
        message: '',
        notification_status: 'pending',
      },
    });
    response = res();
    await notify({ method: 'POST', headers: { 'x-notify-secret': 'retry-secret' }, body: { email: 'guest@example.com' } }, response);
    assert.equal(response.body.notified, false);
    assert.equal(response.body.notification, 'unconfigured');
    assert.equal(pending.calls.some((call) => call.url.includes('api.resend.com')), false);
    assert.equal(pending.read().notification_status, 'unconfigured');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(savedEnv);
  }
});
