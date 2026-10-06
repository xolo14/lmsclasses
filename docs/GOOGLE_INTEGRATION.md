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

## 2. Google Auth Platform (new OAuth console)

The **Overview** page (metrics / token grant rate) is only a dashboard. Do nothing there.
Use the **left menu** in this order: **Branding → Audience → Data Access → Clients → Verification Center**.

### Step A — Branding

1. Click **Branding**.
2. App name: `LMS Classes`.
3. User support email: `info@lmsclasses.com`.
4. App logo: optional.
5. App home page: `https://lmsclasses.com`.
6. Privacy policy: `https://lmsclasses.com/privacy`.
7. Authorized domains: add `lmsclasses.com`.
8. Developer contact: `info@lmsclasses.com`.
9. **Save**.

### Step B — Audience (this is where Testing / Production lives)

1. Click **Audience**.
2. User type:
   - **External** if students use `@gmail.com`.
   - **Internal** only if every user is on your Google Workspace domain.
3. Publishing status:
   - **Testing** = only emails listed under Test users can connect. Tokens expire in 7 days.
   - **In production** = any Google account can start the sign-in (they may see “unverified app”).
4. To leave Testing: click **Publish app** (or **Change to In production**) → confirm.
5. Under **Test users**, keep `info@lmsclasses.com` until verification is approved. Add staff Gmail addresses if you still need Testing.

### Step C — Data Access (scopes)

1. Click **Data Access**.
2. **Add or remove scopes**. Include:
   - `openid`
   - `.../auth/userinfo.email` (email)
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.freebusy` only if `ENABLE_FREEBUSY=true`
3. **Save**. `calendar.events` is a *sensitive* scope — Google will ask you to verify.

### Step D — Clients (if the Web client is not created yet)

1. Click **Clients** → **Create client**.
2. Application type: **Web application**.
3. Authorized redirect URIs (exact, no trailing slash):

```
http://localhost:3000/api/google/callback
https://lmsclasses.com/api/google/callback
http://localhost:3000/api/google/signin
https://lmsclasses.com/api/google/signin
```

The `/api/google/signin` URIs are for **website login** (existing LMS users only).
Hostinger WAF blocks `/api/auth/callback/google`, so do not use that path for login.
The `/api/google/callback` URIs stay for **Calendar / Meet connect**. Do not mix the two.

4. Copy Client ID and Client secret into Hostinger `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. Hostinger `GOOGLE_REDIRECT_URI` must be `https://lmsclasses.com/api/google/callback`.

### Step E — Verification Center (real / not Testing)

1. Click **Verification Center**.
2. Complete any red/missing items (branding, scopes, privacy policy).
3. **Submit for verification**.
4. Justification to paste:

> LMS Classes creates Google Calendar events and Meet links for live classes.
> Super Admin connects info@lmsclasses.com as the default Meet host.
> Mentors/admins may connect their own calendar to host.
> Students connect so class times appear on their Google Calendar.
> We only request calendar.events.

5. Upload a short video: Super Admin clicks **Connect platform account**, then a student clicks **Connect** on the dashboard.
6. Upload a screenshot of Settings → Integrations.
7. Wait for Google email. Until approved, users click **Advanced → Go to LMS Classes** on the unverified-app warning.

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
