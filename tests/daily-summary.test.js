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
