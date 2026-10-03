import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { reportClock, buildSummaryEmail } from '../api/daily-summary.js';

test('Chicago 6 PM follows daylight saving and UTC date rollover', () => {
  assert.deepEqual(reportClock(new Date('2026-10-03T23:00:00Z')), { date: '2026-10-03', hour: 18 });
  assert.deepEqual(reportClock(new Date('2026-12-04T00:00:00Z')), { date: '2026-12-03', hour: 18 });
  assert.equal(reportClock(new Date('2026-12-03T23:00:00Z')).hour, 17);
});
test('summary distinguishes reply counts from people and supports zero days', () => {
  const message = buildSummaryEmail([{ event: 'wedding', daily_replies: 0, previous_day_replies: 2, cumulative_replies: 8, attending_people: 21 }], '2026-10-03');
  assert.match(message.text, /today: 0/);
  assert.match(message.text, /previous full day: 2/);
  assert.match(message.text, /Cumulative RSVP replies: 8/);
  assert.match(message.text, /Total people attending: 21/);
});
test('summary rejects unauthenticated requests before querying storage', async () => {
  const response = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  await handler({ method: 'GET', headers: {} }, response);
  assert.equal(response.code, 401);
});

test('report date range includes both endpoints and stops after the final day', async () => {
  const { reportSettings, reportDue } = await import('../api/daily-summary.js');
  const settings = reportSettings({ RSVP_REPORT_START_DATE: '2026-10-03', RSVP_REPORT_END_DATE: '2026-12-01' });
  assert.equal(reportDue({ date: '2026-10-03', hour: 23 }, settings), true);
  assert.equal(reportDue({ date: '2026-12-01', hour: 23 }, settings), true);
  assert.equal(reportDue({ date: '2026-12-02', hour: 23 }, settings), false);
  assert.equal(reportDue({ date: '2026-10-02', hour: 23 }, settings), false);
  assert.equal(reportDue({ date: '2026-10-03', hour: 18 }, settings), false);
  assert.throws(() => reportSettings({}));
  assert.throws(() => reportSettings({ RSVP_REPORT_END_DATE: '2026-02-30' }));
});

test('11 PM Eastern follows daylight saving', () => {
  assert.deepEqual(reportClock(new Date('2026-10-04T03:00:00Z'), 'America/New_York'), { date: '2026-10-03', hour: 23 });
  assert.deepEqual(reportClock(new Date('2026-12-04T04:00:00Z'), 'America/New_York'), { date: '2026-12-03', hour: 23 });
});

test('report includes readable labels for all five events', () => {
  const events = ['wedding', 'reception', 'haldi', 'pellikuthuru_pellikoduku', 'vratham'];
  const rows = events.map(event => ({ event, daily_replies: 0, previous_day_replies: 0, cumulative_replies: 0, attending_people: 0 }));
  const { text } = buildSummaryEmail(rows, '2026-10-03');
  for (const label of ['Wedding', 'Reception', 'Haldi', 'Pellikuthuru and Pellikoduku', 'Vratham']) assert.ok(text.includes(label));
  assert.match(text, /11:00 PM America\/Chicago/);
});
