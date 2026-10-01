# Google Calendar + Google Meet integration

By default, live classes are hosted by the **platform Google account**
(`PLATFORM_GOOGLE_EMAIL`, normally `info@lmsclasses.com`). Super Admin connects that
account once at **Settings → Integrations → Connect platform account**. The assigned mentor
stays the LMS owner (`hostUserId`) and is always added as a calendar attendee.

Only **Super Admin, Manager, and Mentor** can create live classes. Every LMS user
(student, mentor, manager, org admin, super admin) can connect Google Calendar. The
dashboard shows a **Connect** banner until they do; the button starts OAuth immediately.

The LMS database is the source of truth. Google is a side effect: if Google is down or the
host is disconnected, the class is still saved and the Meet link is created later by the retry
cron or by a "Retry Meet link" button.

## 1. Google Cloud project

1. Open <https://console.cloud.google.com/> and create (or pick) a project.
2. **APIs & Services → Library** → enable **Google Calendar API**.

## 2. OAuth consent screen

| Situation | Choose | Notes |
| --- | --- | --- |
| Every host uses a Google Workspace account on your own domain | **Internal** | No Google app verification. Refresh tokens do not expire after 7 days. |
| Hosts use personal `@gmail.com` or mixed accounts | **External** | `calendar.events` is a *sensitive* scope. While the app is in **Testing** status only listed test users can connect and refresh tokens expire after **7 days**. Submit the app for verification before production use. |

Scopes to add on the consent screen:

- `openid`
- `email`
- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/calendar.freebusy` — only if `ENABLE_FREEBUSY=true`

## 3. OAuth client

**APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.**

Authorized redirect URIs:

```
http://localhost:3000/api/google/callback
https://lmsclasses.com/api/google/callback
```

Copy the Client ID and Client secret into the env vars below.

## 3b. Leave Testing — publish for real users

Google **Testing** only allows listed testers (`info@lmsclasses.com` plus anyone you add) and
refresh tokens expire after **7 days**. For real students and mentors:

1. Open [Google Cloud Console](https://console.cloud.google.com/) → the project that owns `GOOGLE_CLIENT_ID`.
2. **APIs & Services → OAuth consent screen**.
3. Confirm **User type = External** if students use `@gmail.com` (or **Internal** if everyone is on your Google Workspace domain).
4. Fill the required app details:
   - App name: `LMS Classes`
   - User support email and developer contact: `info@lmsclasses.com`
   - App home page: `https://lmsclasses.com`
   - Privacy policy URL: a public page on `lmsclasses.com` (Google requires a real URL)
   - Authorized domains: `lmsclasses.com`
5. Scopes (already added): `openid`, `email`, `https://www.googleapis.com/auth/calendar.events`.
6. Click **Publish app** (Testing → **In production**).
7. Confirm the warning. Users will see Google’s “unverified app” screen until verification finishes — they click **Advanced → Go to LMS Classes**.
8. **Submit for verification** (required for the sensitive `calendar.events` scope in production):
   - Explain: *“LMS Classes creates Google Calendar events and Meet links for live classes. Students connect so class times appear on their calendar. Mentors/admins connect so they can host.”*
   - Upload a short demo video of Super Admin connecting the platform account and a student clicking **Connect** on the dashboard.
   - Add a screenshot of the Integrations page.
9. While verification is pending, keep a few **test users** listed so staff can still connect.
10. After Google approves, any Google account can connect and refresh tokens no longer expire after 7 days.

Do **not** mix this with GCS video credentials (`GCP_*` / `GCS_*`).

## 4. Environment variables

Add to `.env.local` (and to the Hostinger environment):

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://lmsclasses.com/api/google/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=   # 32 bytes base64 → openssl rand -base64 32
GOOGLE_STATE_SECRET=           # any long random string
PLATFORM_GOOGLE_EMAIL=info@lmsclasses.com
ENABLE_FREEBUSY=false
```

- `GOOGLE_TOKEN_ENCRYPTION_KEY` encrypts refresh/access tokens at rest (AES‑256‑GCM). The app
  refuses to start Google features if the decoded key is not exactly 32 bytes.
- Rotating `GOOGLE_TOKEN_ENCRYPTION_KEY` invalidates every stored connection; hosts must reconnect.
- `GOOGLE_REDIRECT_URI` must match one of the redirect URIs registered in step 3 exactly.

After changing env values on Hostinger: **Save → Restart** the Node app.

Then run the schema push once:

```
npm install
npm run db:push
```

## 5. Google Meet limits

Free personal Google accounts cap group calls (roughly **60 minutes** and **100 participants**;
verify the current limits at <https://support.google.com/meet/answer/9903283>). Mentors who run
classes longer than an hour should host from a **Google Workspace** account.

The schedule form shows a warning when the host is a `@gmail.com` account and the class is longer
than 60 minutes or the batch has more than 100 students. Super Admins see the same warning when
the **platform** account is Gmail.

## 6. Cron jobs (Hostinger)

Hostinger has no built-in Next.js cron. Use hPanel **Advanced → Cron Jobs** (or any external
scheduler) to call these endpoints with the `CRON_SECRET` bearer token:

| Schedule | Command |
| --- | --- |
| Every 10 min | `curl -s -H "Authorization: Bearer $CRON_SECRET" https://lmsclasses.com/api/cron/google-retry` |
| Daily | `curl -s -H "Authorization: Bearer $CRON_SECRET" https://lmsclasses.com/api/cron/google-health` |

- **google-retry** re-runs Meet creation for classes whose `meet_status` is `pending` or `failed`,
  start time is in the future and `retry_count < 5`, with exponential backoff on `last_attempt_at`.
  After the 5th failure it emails the host and the Super Admins.
- **google-health** refreshes tokens for connections unused for 30+ days and marks
  `needs_reconnect` (and emails the user) when Google returns `invalid_grant`.

## 7. How a class gets its Meet link

1. The scheduler picks a **host** (defaults to the assigned mentor) and a **Meet mode**:
   - *Create Meet via host's Google* — uses the host's connection.
   - *Use my Google account* — the scheduler becomes the host (must be connected).
   - *Paste Meet link manually* — `meet_status = manual`.
   - *No video link*.
2. The class row is inserted first (`meet_status = pending`) and the API responds immediately.
3. In the background the LMS calls `events.insert` with `conferenceDataVersion: 1` and a stable
   `requestId = lms-<classId>-v<version>` so retries never create duplicate events.
4. On success the row gets `google_event_id`, `meeting_link`, `calendar_html_link`,
   `meet_status = created`. Students then receive the LMS email / WhatsApp with the **LMS join
   URL** (`/api/live-classes/<id>/join`) — never the raw Meet link.
5. Reschedules patch the same event (same Meet link). Cancel/delete removes the event. Enrollment
   changes re-sync attendees for every upcoming class of that course.

## 8. Join flow and attendance

`GET /api/live-classes/<id>/join` checks the session, the enrollment (`live_access`, batch, access
window), and the time window (10 min before start → 30 min after end). For students it upserts a
`live_class_attendance` row and audits `live_class.join_clicked`, then redirects to the Meet link.

A join click is a proxy for attendance, not proof. Verified attendance via the Google Meet REST
API (`conferenceRecords.participants`, scope `meetings.space.readonly`) is left as a documented
extension point in `lib/services/liveClassGoogleSync.ts` and is **off**.

## 9. Revoking access

Users can disconnect from **Settings → Integrations** (the LMS revokes the token at Google and
deletes it locally; existing events and Meet links stay). They can also remove the LMS at
<https://myaccount.google.com/permissions>; the next Google call will mark the connection
`needs_reconnect` and email them.
