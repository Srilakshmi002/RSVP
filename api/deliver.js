import { emailConfig, sendRsvpEmail } from './email.js';
import { claimNotification, getRsvp, patchRsvp } from './store.js';

async function record(id, fields, event) {
  try {
    return await patchRsvp(id, fields, event);
  } catch {
    return { ok: false };
  }
}

export async function deliverNotification(rsvp) {
  if (rsvp.notification_status === 'sent') {
    return { notified: true, notification: 'sent', alreadySent: true };
  }

  const mail = emailConfig();
  if (!mail.configured) {
    await record(rsvp.id, {
      notification_status: 'unconfigured',
      notification_error: 'Email service is not configured.',
    }, rsvp.event);
    return { notified: false, notification: 'unconfigured', alreadySent: false };
  }

  let claim;
  try {
    claim = await claimNotification(rsvp.id, rsvp.event);
  } catch {
    return { notified: false, notification: 'failed', alreadySent: false, error: 'The notification could not be started. The RSVP is still saved.' };
  }
  if (!claim.ok) {
    return { notified: false, notification: 'failed', alreadySent: false, error: 'The notification status could not be updated. The RSVP is still saved.' };
  }
  if (!claim.claimed) {
    const current = await getRsvp({ id: rsvp.id, event: rsvp.event });
    if (current?.notification_status === 'sent') {
      return { notified: true, notification: 'sent', alreadySent: true };
    }
    return { notified: false, notification: 'in_progress', alreadySent: false };
  }

  let result;
  try {
    result = await sendRsvpEmail(rsvp);
  } catch {
    result = { ok: false, error: 'Email delivery failed.' };
  }

  if (result.ok) {
    await record(rsvp.id, {
      notification_status: 'sent',
      notification_error: null,
      notified_at: new Date().toISOString(),
      notification_id: result.id || null,
    }, rsvp.event);
    return { notified: true, notification: 'sent', alreadySent: false };
  }

  await record(rsvp.id, {
    notification_status: 'failed',
    notification_error: String(result.error || 'Email delivery failed.').slice(0, 500),
  }, rsvp.event);
  return { notified: false, notification: 'failed', alreadySent: false, error: result.error || 'Email delivery failed.' };
}
