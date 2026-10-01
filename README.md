# Pradeep & Anusha · Wedding RSVP

A responsive React wedding invitation with a traditional South Indian palette, a short opening animation, and an RSVP form for attendance, additional guests, the primary guest’s meal, dietary notes, and a personal message. Built with Vite and React. Ready for Vercel, with a serverless RSVP API, optional Supabase storage, and optional Resend email notifications.

Names are shown as **groom & bride** everywhere.

## Run locally

Requires Node.js 22.12+.

```sh
npm install
npm run dev
```

`npm run dev` is **preview mode**. The form validates and confirms on screen, but it does not save an RSVP or send email, because Vite does not run the `api/` functions. The confirmation says the response was not saved.

`npm run preview` only serves the built frontend. Use [Vercel development tooling](https://vercel.com/docs/cli) (`vercel dev`) with your environment variables when you want to exercise `/api/rsvp` locally.

## Personalize

Edit **`src/config.js`**. That file holds:

- Groom and bride first and last names
- Portrait image paths
- Date, Muhurtham time, RSVP deadline, venue name, and street address
- Public contact email (`contactEmail`)
- Schedule and attire
- Time zone used to label the notification email (`timezone`, `America/Chicago`, the local time in Aubrey, Texas)

The browser tab title is set from those names when the page loads. Also update the `<title>` in `index.html` so the tab is correct before JavaScript runs.

### Couple portraits

Placeholder illustrations live in:

- `public/images/groom-placeholder.svg`
- `public/images/bride-placeholder.svg`

Replace those files with your photos (keep the same names), or change `groomImage` and `brideImage` in `src/config.js` to new files in `public/`. The opening animation and the invitation both use these paths.

The opening plays once each time the page loads. **Skip intro** dismisses it. Guests who prefer reduced motion skip the animation and see the invitation immediately. There is no music.

### Additional guests

The form asks how many additional guests are coming with the person filling it out. It starts at 0, so the total attending is 1. The minus button stops at 0. There is no maximum. Declining hides the count and saves the total attending as 0. Names and meals are collected only for the person completing the form.

## Meals

The person completing the form chooses **Veg**, **Non Veg**, or **Both**. That choice is theirs alone. A declined invitation does not ask for a meal. Dietary notes are optional and are hidden when the guest declines.

## Supabase

1. Create a Supabase project.
2. For a new project, run `database/schema.sql` in the SQL editor.
3. If you already created `public.rsvps` from an earlier schema, run `database/migration-meals-and-notifications.sql` first when that table does not yet have meal checks. Then run `database/migration-additional-guests.sql`. That migration keeps existing rows, including guest names already stored, and adds `meal`, `additional_guests`, and `total_attending`. Attending rows need a primary meal of `Veg`, `Non Veg`, or `Both` before it will finish. A brand-new database only needs `database/schema.sql`.
4. In Vercel, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Copy the names from `.env.example`. Never expose the service role key in frontend code or give it a `VITE_` prefix.
5. Redeploy, submit a test RSVP, and confirm the row in the Supabase `rsvps` table before sharing the site.

No database variables means an explicitly labeled preview: nothing is saved and no email is sent. Setting only one of the two variables returns an error. One response is allowed per email address. Guests should contact you to change a response. Row-level security is on, with no public policies. Read and export responses from the Supabase dashboard.

## Email notifications

After a response is saved, the API emails you through [Resend](https://resend.com). The message includes the primary guest’s name and email, attendance, the number of additional guests, the total attending, the primary guest’s meal preference, dietary notes, the personal message, and the submission time with the time zone named (from `timezone` in `src/config.js`). It does not list names or meals for additional guests.

Notifications are sent for both accepted and declined invitations. Opening the RSVP section does not send email. Only a completed submission does.

### Configure the sender

1. Create a Resend account and an API key.
2. Verify the domain you will send from: Resend → Domains → add the domain and the DNS records Resend shows you. An unverified sender will not deliver.
3. Set these Vercel environment variables (see `.env.example`):
   - `RESEND_API_KEY`
   - `RSVP_FROM_EMAIL` — an address on the verified domain, for example `Wedding RSVP <rsvp@yourdomain.com>`
   - `RSVP_NOTIFY_EMAIL` — the inbox that should receive each RSVP
   - `NOTIFY_RETRY_SECRET` — a long random string, used only to retry failed notifications
4. Redeploy after changing environment variables.

Until all three email values are set, RSVPs can still be saved, and the guest is told their response was saved. The site does **not** tell them an email was sent. The row’s `notification_status` is `unconfigured`.

These values stay on the server. They are not referenced from `src/`.

### If delivery fails

The saved RSVP is kept. `notification_status` becomes `failed`, and `notification_error` stores a short provider message. The guest still sees that the RSVP was saved, not that an email was sent.

Find rows that still need a notification:

```sql
select id, email, name, notification_status, notification_error, created_at
from public.rsvps
where notification_status in ('failed', 'unconfigured', 'pending', 'sending')
order by created_at desc;
```

Retry without creating another RSVP:

```sh
curl -sS -X POST "https://YOUR-DOMAIN/api/notify" \
  -H "content-type: application/json" \
  -H "x-notify-secret: $NOTIFY_RETRY_SECRET" \
  -d '{"email":"guest@example.com"}'
```

You can send `{"id":"<uuid>"}` instead of an email. A row already marked `sent` returns `alreadySent: true` and is not emailed again. Retries use the RSVP id as a Resend idempotency key, so a repeat during Resend’s idempotency window does not create a second message. A `sending` status older than two minutes can be claimed again.

`/api/notify` does nothing unless `NOTIFY_RETRY_SECRET` is set, and it never inserts a new RSVP.

## Deploy to Vercel

1. Push this project to your Git provider and import it into Vercel.
2. Select the **Vite** framework preset. Build command: `npm run build`. Output directory: `dist`.
3. Add the Supabase variables, and the Resend variables when you are ready to send mail.
4. Deploy. Vercel serves `api/rsvp.js` at `/api/rsvp` and `api/notify.js` at `/api/notify`.

You can deploy without Supabase to review the design. Those responses are previews and are not saved. This project has not been deployed for you.

## What stays in preview until you add credentials

| Feature | Until you set |
| --- | --- |
| Saving RSVPs | `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` |
| Emailing you each RSVP | `RESEND_API_KEY`, `RSVP_FROM_EMAIL` (verified domain), and `RSVP_NOTIFY_EMAIL` |
| Retrying a failed email | `NOTIFY_RETRY_SECRET`, plus the email variables above |

Local `npm run dev` is always a preview, even if a `.env` file exists, because the API is not running.

## Checks

```sh
npm test
npm run build
```

Tests cover validation, meals, accepting and declining, preview mode, database success, duplicate RSVPs, storage failures, successful email, email failure after a save, unconfigured email, and notification retries (including duplicates). Database and email calls are mocked.
