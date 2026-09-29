# AI Envisioning Workshop Management — Project Plan

## 1. Purpose

Build a Dell + Microsoft co-branded workshop management platform for AI Envisioning Workshops.

The system must manage the full lifecycle of a workshop:

`Request -> Review -> Planned -> Executed -> Follow-up -> Completed`

A declined request follows:

`Request -> Review -> Declined`

Each workshop is a persistent record. All request data, approval data, funding, execution proof, survey responses, commercial outcomes, status history, and reporting data remain associated with that workshop.

The product has two main experiences:

1. A public/client-facing requester and tracking portal for AE/CST users.
2. A separately authenticated admin portal for approval, workshop management, funding, configuration, and reporting.

This file is the implementation roadmap. Each phase is intentionally small enough to be given to Codex independently. Do not start the next phase until the current phase passes its verification checklist.

---

## 2. Locked Product Decisions

These decisions should be treated as project requirements unless explicitly changed later.

### 2.1 Requester identity model

AE/CST users do **not** create persistent password-based accounts.

They authenticate using email OTP.

For workshop creation:

1. User enters work email.
2. Email domain must be in the configured allow-list of approved client domains.
3. System sends a one-time password.
4. User verifies the OTP.
5. User receives a short-lived requester session.
6. User may submit a workshop request.

For workshop tracking:

1. User opens the unique workshop tracking URL.
2. The tracking URL alone grants no access.
3. User enters an email address.
4. The email domain must exactly match the workshop creator's stored domain.
5. System sends an OTP to that email.
6. After successful OTP verification, the user can access that workshop.

Example:

- Creator: `john@dell.com`
- Workshop access domain: `dell.com`
- `jane@dell.com`: allowed after OTP verification.
- `person@gmail.com`: denied.
- `user@microsoft.com`: denied unless the workshop was created from `microsoft.com`.

The domain check must always be performed server-side.

### 2.2 Tracking link

Every workshop gets:

- an internal database UUID;
- a human-readable workshop ID;
- a non-guessable public tracking token;
- a tracking URL;
- a QR code representing the tracking URL.

The tracking token identifies the workshop but is **not** an authentication credential.

The tracking link and workshop ID are sent to the creator's verified email immediately after submission.

### 2.3 Admin identity model

Admins use a separate admin login.

Initial implementation:

- admin email + password;
- password hashed using Argon2id;
- secure HTTP-only session cookie;
- admin users stored separately from requester identities.

The implementation should keep authentication isolated enough that client SSO can replace the local admin login later without redesigning the application.

### 2.4 Workshop statuses

Use these canonical statuses:

- `pending_review`
- `planned`
- `executed`
- `follow_up`
- `completed`
- `declined`

Default transitions:

- new request -> `pending_review`
- admin approval -> `planned`
- admin decline -> `declined`
- scheduled workshop end time passes -> `executed`
- execution details submitted -> `follow_up`
- completion/outcome details submitted -> `completed`

Authorized admins may override a phase when necessary. Every status change must be written to status history.

`executed` means the scheduled workshop time has passed and execution information is now expected. Execution proof is tracked separately, so an automatic transition must not fabricate proof of delivery.

### 2.5 Funding rule

The platform has an overall program budget in one configured currency.

For each workshop store:

- funding required: yes/no;
- requested funding amount;
- approved funding amount;
- actual funding amount.

Default budget behavior:

- requested funding does not reduce available budget;
- admin approval commits the approved amount and reduces available budget;
- when actual funding is finalized, the actual amount replaces the commitment;
- unused committed funds return to available budget;
- spending above the approved amount requires an explicit admin adjustment and must not silently exceed the available budget.

All funding changes must be auditable.

### 2.6 Survey model

Survey submissions are repeatable.

One workshop may have zero, one, or many survey responses.

Survey questions are database-backed so they can be changed without rewriting the workshop schema.

### 2.7 Files

Execution proof uploads are stored outside PostgreSQL in S3-compatible object storage.

For local development use MinIO.

Store only file metadata and object keys in PostgreSQL.

### 2.8 Email

Use SendGrid through a provider abstraction.

For local development, Mailpit may remain available as a local email inspection tool, but application email delivery should be built around a SendGrid adapter unless explicitly changed.

Email is required for:

- OTP codes;
- workshop submission confirmation;
- tracking link delivery;
- approval notification;
- decline notification.

Later reminder emails may use the same notification infrastructure.

---

## 3. Technology Stack

### Frontend

- React
- TypeScript
- Vite
- Shadcn components and tailwind
- React Router
- TanStack Query
- React Hook Form
- Zod
- accessible component primitives
- CSS variables/design tokens for Dell + Microsoft co-branding

### Backend

- Node.js LTS
- TypeScript
- NestJS
- Zod request/response validation
- Type ORM
- PostgreSQL
- Pino structured logging
- Argon2id for admin password hashing
- secure cookie-based sessions
- SendGrid email adapter
- QR-code library
- S3-compatible object storage client

### Infrastructure

- Docker
- Docker Compose
- PostgreSQL
- MinIO
- Mailpit
- production-ready multi-stage images

---

## 4. Repository Layout

Use one repository containing two independent npm projects:

```text
backend/
frontend/
```

Do not create a root npm workspace, root `package.json`, root shared package, `apps/`, or `packages/` directory unless explicitly requested later.

Backend-specific package files and tooling configuration live in `backend/`.
Frontend-specific package files and tooling configuration live in `frontend/`.
The root is the Git repository boundary, so keep a single root `.gitignore`.
Other root-level files should be limited to repository documentation and coordination files such as `Project.md` and `agents.md`.

---

## 5. Engineering Rules

All phases should follow these rules:

- TypeScript strict mode.
- No business logic only in the React client.
- Authorization is enforced in the backend.
- Never trust a tracking token as authentication.
- Never store raw OTP codes.
- Never store admin passwords in plaintext.
- Database schema changes must use migrations.
- Every API input is validated.
- Money is stored as integer minor units or PostgreSQL `numeric`, never floating-point.
- Dates are stored in UTC.
- Workshop timezone is stored explicitly.
- Email addresses and domains are normalized to lowercase before comparison.
- Do not log OTP values, passwords, session tokens, or sensitive file URLs.
- All admin mutations and lifecycle transitions are auditable.
- Public error messages must not reveal whether arbitrary email addresses exist.
- Accessibility is required for forms, dialogs, status indicators, and keyboard navigation.
- All critical workflows require automated tests before the project is considered complete.

---

Also we use npm (package manager). Do not use pnpm or yarn commands.

# PHASED IMPLEMENTATION

---

## Phase 0 — Repository Bootstrap

### Goal

Create the monorepo and establish the development conventions.

### Implement

Create:

- independent `frontend/` npm project using React/Vite/TypeScript;
- independent `backend/` npm project using NestJS/TypeScript;
- backend worker entrypoint inside `backend/`;
- ESLint config inside each project;
- Prettier config inside each project;
- TypeScript strict config inside each project;
- `.editorconfig` inside each project;
- one root `.gitignore`;
- `.env.example` inside each project.

Each project should support:

```bash
npm run dev
npm run build
npm run test
npm run lint
npm run typecheck
```

Install dependencies separately:

```bash
cd backend
npm install

cd ../frontend
npm install
```

Only the backend should expose:

```http
GET /api/health
```

Response:

```json
{
  "status": "ok"
}
```

The web app should display a basic project shell.

### Verification

- Verify what is done is correct

---

## Phase 1 — Local Docker Development Environment

### Goal

Make the entire local dependency stack reproducible.

### Implement

Create `docker-compose.yml` with:

- PostgreSQL;
- MinIO;
- Mailpit;
- API;
- worker;
- optionally web dev server.

Expose only development ports.

Add health checks.

Create named volumes for PostgreSQL and MinIO.

Add environment variables for:

```text
DATABASE_URL
APP_BASE_URL
API_BASE_URL
SESSION_SECRET
OTP_SECRET
SENDGRID_API_KEY
EMAIL_FROM
S3_ENDPOINT
S3_REGION
S3_ACCESS_KEY
S3_SECRET_KEY
S3_BUCKET
PROGRAM_CURRENCY
```

Create startup logic that ensures the MinIO bucket exists in development.

### Verification

Run:

```bash
docker compose up --build
```

Verify:

- PostgreSQL is healthy.
- API connects to PostgreSQL.
- MinIO console is reachable.
- Mailpit UI is reachable.
- API health endpoint is reachable.
- restarting containers preserves database and object-storage data.

---

## Phase 2 — Database Foundation and Migrations

### Goal

Introduce TypeOrm and the first durable data model.

### Implement

Create the initial schema with:

### `allowed_domains`

```text
id
domain
display_name
active
created_at
updated_at
```

Domain must be unique and lowercase.

### `admin_users`

```text
id
email
password_hash
display_name
active
created_at
updated_at
last_login_at
```

### `workshops`

Initial fields:

```text
id
workshop_code
tracking_token
creator_name
creator_email
creator_domain
requester_role
customer_name
country_code
location
timezone
planned_start_at
duration_minutes
estimated_attendees
execution_support_required
execution_support_details
funding_required
requested_funding_amount
currency_code
description
status
decline_reason
created_at
updated_at
approved_at
declined_at
completed_at
```

Create enums where appropriate.

Create indices for:

- `workshop_code`
- `tracking_token`
- `status`
- `country_code`
- `creator_email`
- `creator_domain`
- `planned_start_at`

Create the first migration.

Seed:

- at least one approved local test domain;
- one local admin user from development-only seed values.

Do not seed production passwords.

### Verification

- empty database can be created entirely from migrations;
- migration rollback/rebuild workflow is documented;
- seed works in development;
- workshop code and tracking token are unique;
- invalid duplicate allowed domains are rejected.

---

## Phase 3 — Core API Structure

### Goal

Create a maintainable backend before feature work expands.

### Implement

Add:

- route layer;
- controller layer;
- service layer;
- repository/data layer;
- validation layer;
- centralized error handling;
- request ID middleware;
- structured Pino logging;
- environment validation;
- API response conventions.

Suggested API structure:

```text
/api/public/*
/api/requester/*
/api/tracking/*
/api/admin/*
```

Add a typed `AppError` model with safe client messages.

Add 404 and validation error handling.

### Verification

- malformed JSON returns controlled error.
- invalid request data returns HTTP 400.
- unknown routes return HTTP 404.
- server errors do not leak stack traces in production mode.
- every request receives a request/correlation ID.

---

## Phase 4 — Email and OTP Infrastructure

### Goal

Build reusable OTP authentication primitives.

### Implement

Add `otp_challenges`:

```text
id
email
purpose
workshop_id nullable
code_hash
expires_at
attempt_count
max_attempts
consumed_at nullable
created_at
request_ip
```

Supported purposes:

```text
create_workshop
track_workshop
```

OTP requirements:

- 6 digits;
- cryptographically secure generation;
- store only a keyed hash/HMAC of the OTP;
- 10-minute expiry;
- single use;
- maximum verification attempts;
- resend cooldown;
- rate limit by email and IP;
- old active OTPs for the same purpose may be invalidated when a new one is issued.

Create SendGrid adapter.

Create HTML + plain text OTP email templates.

Do not reveal raw OTPs in API responses or logs.

### Verification

- OTP email is sent through the configured SendGrid adapter. In local development, verify through the selected development-safe email sink or SendGrid sandbox/test mode.
- correct OTP succeeds.
- incorrect OTP fails.
- expired OTP fails.
- consumed OTP cannot be reused.
- resend cooldown works.
- attempt limit works.
- logs contain no OTP values.

---

## Phase 5 — Requester Pre-Authentication

### Goal

Allow only approved domains to begin creating a workshop.

### Implement

Endpoints:

```http
POST /api/public/request-access/send-otp
POST /api/public/request-access/verify-otp
POST /api/public/request-access/logout
GET  /api/requester/session
```

`send-otp`:

- normalize email;
- extract exact domain after `@`;
- confirm the domain exists in `allowed_domains` and is active;
- send OTP.

`verify-otp`:

- validate OTP;
- create a short-lived requester session;
- session stores verified email and verified domain.

Use a secure HTTP-only cookie.

Recommended requester creation session lifetime: 60 minutes.

Cookie settings in production:

```text
HttpOnly
Secure
SameSite=Lax
```

### Verification

- approved domain can request OTP.
- unapproved domain cannot obtain requester access.
- verified OTP creates session.
- requester session endpoint returns verified email/domain.
- logout invalidates session.
- requester-only endpoint cannot be used without session.

---

## Phase 6 — Workshop Request Form

### Goal

Build the real requester form.

### Implement

Create React pages for:

```text
/
 /request/auth
 /request/new
 /request/success
```

Fields:

- requester name;
- verified requester email, read-only;
- role: AE or CST;
- customer name;
- country;
- location;
- workshop timezone;
- planned date/time;
- estimated duration;
- estimated attendees;
- execution support required;
- execution support details;
- funding required;
- requested funding amount;
- workshop description/objectives.

Behavior:

- funding amount required only if funding required = yes;
- support details required only if support required = yes;
- reasonable min/max validation;
- date/time must be valid;
- accessible validation messages;
- submit button prevents duplicate submission.

Backend endpoint:

```http
POST /api/requester/workshops
```

Workshop creation must use creator email/domain from the verified requester session, never from trusted client input.

Generate:

- workshop UUID;
- human-readable workshop code;
- random tracking token;
- initial status `pending_review`.

Suggested human-readable format:

```text
AIW-2026-000001
```

Use a database-safe sequence/counter; do not generate by counting rows.

### Verification

- form cannot open without verified requester session.
- workshop can be created with valid values.
- creator email/domain cannot be forged in request payload.
- initial status is `pending_review`.
- workshop code is unique.
- tracking token is long and non-guessable.
- duplicate clicking does not create duplicate workshops.

---

## Phase 7 — Submission Confirmation, Tracking Email, and QR Code

### Goal

Complete the workshop creation experience.

### Implement

After successful creation:

Generate tracking URL:

```text
{APP_BASE_URL}/workshops/{tracking_token}
```

Generate QR code containing exactly that tracking URL.

Send the creator a confirmation email containing:

- creator name;
- customer name;
- workshop code;
- planned date;
- current status;
- tracking URL;
- QR code, inline or attached;
- security message explaining that the link still requires email OTP verification.

The link is sent to the creator's verified email address automatically.

The success page should show:

- workshop code;
- confirmation that an email was sent;
- tracking link;
- QR code;
- current status.

Do not rely on the success page as the only place the link exists.

### Verification

- creator receives confirmation email through the configured SendGrid adapter. In local development, verify through the selected development-safe email sink or SendGrid sandbox/test mode.
- URL in email points to correct tracking token.
- QR code resolves to the same URL.
- tracking token alone does not expose workshop information.
- refresh of success page does not generate a new workshop.

---

## Phase 8 — Tracking-Link Domain OTP Authentication

### Goal

Protect leaked tracking links while allowing anyone from the creator's domain.

### Implement

Public page:

```text
/workshops/:trackingToken
```

Before authentication, display only generic access UI. Do not expose:

- customer name;
- creator name;
- funding;
- location;
- status details;
- workshop description.

Endpoints:

```http
POST /api/public/workshops/:trackingToken/send-otp
POST /api/public/workshops/:trackingToken/verify-otp
```

`send-otp` behavior:

1. Find workshop by tracking token.
2. Normalize submitted email.
3. Extract email domain.
4. Compare exact domain to `workshop.creator_domain`.
5. If mismatch, deny access.
6. If match, create OTP challenge for `track_workshop`.
7. Send OTP.

After verification create a tracking session.

The tracking session must retain:

- verified email;
- verified domain;
- workshop ID or authorization scope;
- expiry.

Recommended lifetime: 8 hours.

Do not make the session valid for a different-domain workshop.

If a session already has the correct verified domain, it may access another tracking link from the same domain only if explicitly designed. Default implementation should scope it to the workshop for least privilege.

### Verification

For a workshop created by `john@dell.com`:

- `jane@dell.com` can authenticate and access.
- `john@dell.com` can authenticate and access.
- `person@gmail.com` cannot.
- `user@microsoft.com` cannot.
- random tracking token returns generic not-found behavior.
- unauthenticated GET cannot read workshop JSON.
- changing the URL after login does not grant access to another workshop.

---

## Phase 9 — Workshop Tracking Dashboard

### Goal

Give authenticated AE/CST users a clear lifecycle page.

### Implement

Create requester/tracking view displaying:

- workshop code;
- customer;
- requester;
- role;
- country/location;
- scheduled date/time;
- duration;
- estimated attendees;
- execution support;
- funding request summary;
- description/objectives;
- current phase;
- lifecycle timeline.

Show states:

- Pending review
- Planned
- Executed
- Follow-up
- Completed
- Declined

For declined workshops show decline reason.

Only show actions appropriate to the current phase.

Add server endpoint such as:

```http
GET /api/tracking/workshops/:trackingToken
```

Tracking authentication middleware must resolve the token to the authorized workshop and verify session scope.

### Verification

- authenticated same-domain user sees details.
- declined reason appears only for declined record.
- phase timeline matches backend state.
- controls unavailable for the current state cannot be invoked through API manually.

---

## Phase 10 — Admin Authentication

### Goal

Create a secure, isolated admin session.

### Implement

Pages:

```text
/admin/login
/admin
```

Endpoints:

```http
POST /api/admin/auth/login
POST /api/admin/auth/logout
GET  /api/admin/auth/session
```

Requirements:

- Argon2id password hash.
- generic invalid-credentials response.
- login rate limiting.
- secure HTTP-only cookie.
- idle/session expiry.
- update `last_login_at`.
- inactive admin accounts cannot log in.

Add middleware:

```text
requireAdmin
```

Admin cookie/session must be separate from requester/tracking sessions.

### Verification

- valid admin can log in.
- invalid password is rejected.
- inactive admin cannot log in.
- admin routes are inaccessible without admin session.
- logout invalidates admin session.
- password hash is never returned by APIs.

---

## Phase 11 — Admin Workshop Queue and Detail View

### Goal

Let admins inspect all workshop requests.

### Implement

Admin routes:

```text
/admin/workshops
/admin/workshops/:id
```

List columns:

- workshop code;
- customer;
- creator;
- role;
- country;
- planned date;
- status;
- funding requested;
- created date.

List functionality:

- pagination;
- search;
- sort;
- status filter;
- country filter;
- AE/CST role filter;
- creator filter.

Detail view should show the complete request.

Backend:

```http
GET /api/admin/workshops
GET /api/admin/workshops/:id
```

All filtering must happen server-side.

### Verification

- pagination works.
- filters combine correctly.
- no requester session can call admin list/detail APIs.
- admin can open a complete workshop detail record.

---

## Phase 12 — Approval and Decline Workflow

### Goal

Implement admin review.

### Implement

Endpoints:

```http
POST /api/admin/workshops/:id/approve
POST /api/admin/workshops/:id/decline
```

Approval:

- only allowed from `pending_review`;
- moves to `planned`;
- stores approval timestamp;
- accepts approved funding amount when applicable.

Decline:

- only allowed from `pending_review`;
- requires decline reason;
- moves to `declined`;
- stores decline timestamp.

Create `workshop_status_history`:

```text
id
workshop_id
from_status
to_status
changed_by_type
changed_by_admin_id nullable
changed_by_email nullable
reason nullable
created_at
```

Send approval/decline email to creator.

### Verification

- pending request can be approved.
- pending request can be declined.
- second approval/decline is rejected.
- decline reason is required.
- history entry is created.
- creator receives decision email.
- tracking page reflects new status.

---

## Phase 13 — Program Budget and Funding Commitments

### Goal

Implement reliable budget control.

### Implement

Create:

### `program_budgets`

```text
id
name
currency_code
total_amount
active
created_at
updated_at
```

### `workshop_funding`

```text
id
workshop_id
budget_id
requested_amount
approved_amount nullable
actual_amount nullable
committed_at nullable
finalized_at nullable
created_at
updated_at
```

Create funding audit/ledger table:

```text
funding_ledger
id
budget_id
workshop_id nullable
entry_type
amount
note
admin_user_id
created_at
```

Suggested entry types:

```text
budget_created
budget_adjusted
commitment_created
commitment_adjusted
commitment_released
spend_finalized
```

Budget calculations must be transaction-safe.

Admin dashboard metrics:

- total budget;
- committed;
- actual spent;
- available.

Prevent approval if the new commitment would exceed available budget unless an explicit privileged budget adjustment is made first.

Do not use JavaScript floating-point arithmetic for money.

### Verification

- approving funding commits correct amount.
- available budget decreases.
- declining a request does not consume budget.
- concurrent approvals cannot oversubscribe budget.
- ledger contains auditable entries.
- currency mismatch is rejected.
- non-funded workshop has no accidental commitment.

---

## Phase 14 — Execution Phase and Proof Uploads

### Goal

Capture what actually happened.

### Implement

Create `workshop_execution`:

```text
id
workshop_id
actual_attendees
notes
submitted_by_email
submitted_at
created_at
updated_at
```

Create `workshop_files`:

```text
id
workshop_id
category
original_filename
object_key
mime_type
size_bytes
uploaded_by_email
created_at
```

Allowed execution proof types should initially include:

- JPEG
- PNG
- PDF
- common calendar invite file if required

Set configurable max file size.

Upload path:

```text
workshops/{workshopId}/execution/{uuid}-{safeFilename}
```

Do not expose raw MinIO/S3 credentials.

Tracking user can:

- enter actual attendee count;
- enter execution notes;
- upload one or more proof files;
- submit execution information.

Require at least one proof file unless an admin override is recorded.

After valid execution submission:

```text
executed -> follow_up
```

### Verification

- valid files upload.
- blocked MIME/file types are rejected.
- oversized files are rejected.
- file metadata is in PostgreSQL.
- binary file is in MinIO.
- another workshop cannot access the file.
- execution submission stores verified user's email.
- transition to `follow_up` is recorded in history.

---

## Phase 15 — Secure File Download

### Goal

Ensure proof files are private.

### Implement

Provide authenticated file download endpoints.

Requester/tracking access:

- must have valid tracking authorization for the same workshop.

Admin access:

- valid admin session.

Use either:

- short-lived presigned S3 URL generated after authorization; or
- server-streamed download.

Do not make the bucket public.

Use safe `Content-Disposition`.

### Verification

- authorized tracking user can view/download own workshop proof.
- different workshop session cannot.
- unauthenticated request cannot.
- admin can download.
- object URLs expire if presigned URLs are used.

---

## Phase 16 — Repeatable Post-Workshop Survey

### Goal

Support multiple survey submissions per workshop.

### Implement

Create:

### `survey_questions`

```text
id
key
label
question_type
required
display_order
active
options_json nullable
created_at
updated_at
```

Support initial question types:

```text
short_text
long_text
rating
single_choice
multi_choice
yes_no
```

Create:

### `survey_submissions`

```text
id
workshop_id
submitted_by_email
respondent_name nullable
respondent_company nullable
submitted_at
```

### `survey_answers`

```text
id
submission_id
question_id
answer_json
```

Tracking UI in `follow_up` phase:

- display active survey;
- submit response;
- after submission show success;
- allow another response.

Survey responses must be snapshots in practice: if a question is later edited, historical reports must retain the original question label or version. Implement either question versioning or answer snapshots.

Do not automatically complete the workshop after one survey because responses are repeatable.

### Verification

- one workshop can have multiple survey submissions.
- another workshop's surveys stay isolated.
- required questions are validated.
- historical responses remain readable after a survey question changes.
- authenticated submitter email is recorded.

---

## Phase 17 — Leads, Opportunities, and Completion Data

### Goal

Capture measurable business outcomes.

### Implement

Create:

### `workshop_leads`

```text
id
workshop_id
lead_reference nullable
description nullable
created_at
created_by_email
```

### `workshop_opportunities`

```text
id
workshop_id
opportunity_reference nullable
name
pipeline_value
currency_code
stage nullable
notes nullable
created_at
created_by_email
```

Create completion summary fields/table for:

- lead count;
- opportunity count;
- total pipeline value;
- completion notes;
- actual funding amount where required.

Avoid storing only aggregate counts if individual lead/opportunity records are being entered. Aggregates should be calculated from records where possible.

Tracking UI should allow:

- adding/removing lead records before final submission;
- adding/removing opportunity records;
- entering opportunity values;
- reviewing summary;
- marking workshop completed.

On completion:

```text
follow_up -> completed
```

Record `completed_at`.

If actual funding is entered, finalize funding transactionally.

### Verification

- multiple leads can be stored.
- multiple opportunities can be stored.
- pipeline totals are correct.
- currency is enforced.
- completion writes status history.
- final funding updates available budget correctly.
- completed workshop becomes read-only for normal tracking users except survey submission if product rules allow it.

Default rule: completed workshop remains viewable but operational fields become read-only.

---

## Phase 18 — Automatic Planned-to-Executed Transition Worker

### Goal

Implement the defined automatic phase change.

### Implement

Worker runs on a schedule, e.g. every 5 minutes.

For workshops where:

```text
status = planned
AND planned_start_at + duration_minutes <= now()
```

transition to:

```text
executed
```

Requirements:

- transaction-safe;
- idempotent;
- safe with multiple worker instances;
- write status history;
- identify transition actor as `system`;
- do not generate fake execution proof;
- do not change declined/completed records.

Use PostgreSQL locking/advisory locking or a safe claim pattern.

### Verification

- expired planned workshop transitions.
- future workshop stays planned.
- transition occurs only once.
- two workers cannot create duplicate history events.
- worker restart does not break behavior.

---

## Phase 19 — Manual Admin Phase Overrides

### Goal

Handle real-world exceptions.

### Implement

Admin action:

```http
POST /api/admin/workshops/:id/status
```

Only allow approved target statuses and require:

- target status;
- reason.

Prevent impossible/destructive transitions unless explicitly supported.

Examples of acceptable overrides:

- `executed -> planned` after date correction;
- `follow_up -> executed` when execution information needs correction;
- `planned -> executed` manually if scheduler has not run.

Do not allow an admin override to erase history.

Completed or declined reopening should require an explicit reason and elevated confirmation in UI.

### Verification

- override creates history entry.
- reason is mandatory.
- requester cannot invoke it.
- audit identifies admin.
- prior history is preserved.

---

## Phase 20 — Admin Funding Management

### Goal

Give admins a usable budget interface.

### Implement

Admin screens:

```text
/admin/budget
/admin/budget/ledger
```

Features:

- view total budget;
- increase/decrease budget with reason;
- view requested vs approved vs actual by workshop;
- adjust approved funding before completion;
- finalize/correct actual funding with audit reason;
- list ledger entries;
- filter by country, workshop, and date.

Every budget mutation must run in a transaction and create an immutable ledger entry.

### Verification

- adjustments update metrics.
- every adjustment has actor, reason, timestamp.
- budget cannot silently go negative.
- workshop funding history can be reconstructed from ledger.

---

## Phase 21 — Admin Configuration: Approved Domains

### Goal

Move client-domain configuration into admin UI.

### Implement

Admin page:

```text
/admin/settings/domains
```

Features:

- list allowed domains;
- add domain;
- deactivate domain;
- reactivate domain;
- display name.

Rules:

- normalize to lowercase;
- reject protocol, path, email address, wildcard unless explicitly supported later;
- exact-domain matching only.

Existing workshops retain their stored creator domain.

For creation, only currently active allowed domains may request creation OTPs.

Tracking access should continue using the workshop's stored domain even if the domain is later deactivated, unless the admin explicitly blocks that workshop. This avoids accidentally locking historical workshops due to configuration cleanup.

### Verification

- new domain works for requester creation.
- deactivated domain cannot create new workshops.
- exact matching behaves correctly.
- `example.com` does not automatically authorize `sub.example.com`.

---

## Phase 22 — Admin Configuration: Request Types and Portal Content

### Goal

Fulfill the CMS requirement without turning the project into a full website builder.

### Implement

Create `request_types`:

```text
id
name
description
active
display_order
```

Add optional `request_type_id` to workshop.

Create simple `content_blocks`:

```text
id
key
title
body
updated_at
updated_by_admin_id
```

Editable keys may include:

```text
landing_intro
request_help
tracking_help
survey_intro
privacy_notice
```

Admin UI may edit approved blocks.

Do not implement arbitrary HTML execution. Sanitize rich text or use Markdown with a safe renderer.

### Verification

- active request types appear on form.
- inactive type cannot be selected for new request.
- existing workshops preserve prior type.
- content edits appear on public UI.
- unsafe script markup is not executed.

---

## Phase 23 — Survey Configuration Admin

### Goal

Allow admins to maintain the customer survey.

### Implement

Admin page:

```text
/admin/settings/survey
```

Features:

- create question;
- edit question;
- activate/deactivate;
- reorder;
- configure options;
- set required flag;
- preview current survey.

Preserve history through versioning or snapshotting.

Do not permit a destructive edit to corrupt existing survey answers.

### Verification

- new question appears in tracking survey.
- disabled question disappears from new survey.
- old survey response still displays its original question wording.
- invalid option configuration is rejected.

---

## Phase 24 — Admin Reporting API

### Goal

Create one reliable reporting data source.

### Implement

Reporting filters:

- date range;
- workshop status;
- country;
- creator/requester;
- AE/CST role;
- customer;
- request type;
- funding required;
- execution proof present/missing;
- survey present/missing;
- completed/not completed.

Return report metrics:

- total workshops;
- counts by status;
- counts by country;
- estimated attendees;
- actual attendees;
- requested funding;
- approved/committed funding;
- actual funding;
- leads;
- opportunities;
- total pipeline value;
- conversion/completion rate where meaningful.

Ensure metrics use the same filtering rules as the report rows.

Add appropriate DB indices after profiling queries.

### Verification

- report row count matches filters.
- totals match database truth.
- combined filters work.
- large result sets use pagination for UI.
- reporting API is admin-only.

---

## Phase 25 — Admin Reporting UI and CSV Export

### Goal

Provide practical ad-hoc reporting.

### Implement

Admin page:

```text
/admin/reports
```

Features:

- filter controls;
- summary KPI cards;
- result table;
- sortable columns;
- pagination;
- reset filters;
- export current filtered dataset as CSV.

CSV must:

- use the active filters;
- use stable headers;
- escape commas, quotes, and line breaks correctly;
- use UTF-8;
- exclude secrets/internal auth data.

Suggested columns:

```text
workshop_code
customer
creator_name
creator_email
requester_role
country
location
planned_start
status
estimated_attendees
actual_attendees
funding_requested
funding_approved
funding_actual
survey_submission_count
lead_count
opportunity_count
pipeline_value
created_at
completed_at
```

### Verification

- CSV rows match UI filters.
- spreadsheet application opens export cleanly.
- special characters do not break CSV.
- no OTP/session/internal tokens appear.

---

## Phase 26 — Individual Workshop Report

### Goal

Support downloadable workshop-level reporting.

### Implement

Admin workshop detail should include a printable report containing:

- workshop identity;
- request details;
- approval/decline data;
- timeline/status history;
- funding summary;
- execution summary;
- proof file references;
- survey summary;
- leads;
- opportunities;
- pipeline total;
- completion details.

Provide:

- printable HTML view;
- PDF download generated server-side.

Do not embed expiring object-storage URLs directly in a permanent PDF. If proof thumbnails are included, fetch them securely during report generation.

### Verification

- report matches workshop data.
- PDF can be downloaded.
- declined workshop report renders correctly.
- missing optional sections do not break layout.

---

## Phase 27 — Dashboard

### Goal

Give admins a useful at-a-glance program view.

### Implement

Admin home dashboard showing:

- pending approvals;
- planned workshops;
- execution information outstanding;
- follow-up workshops;
- completed workshops;
- total program budget;
- committed budget;
- actual spend;
- available budget;
- actual attendees;
- leads;
- opportunities;
- pipeline value.

Add links from each KPI to the relevant filtered list/report.

Keep charting minimal and data-driven. Do not duplicate a BI platform.

### Verification

- KPI counts match reporting endpoints.
- clicking KPI opens correctly filtered view.
- budget cards match funding ledger calculations.

---

## Phase 28 — Branding and Responsive UX

### Goal

Turn the functional system into the client-facing product.

### Implement

Create a design token layer for:

- typography;
- spacing;
- border radius;
- surface colors;
- primary/secondary accents;
- focus states.

Use client-provided Dell and Microsoft logo assets.

Do not scrape or hotlink brand assets.

Apply co-branding to:

- landing page;
- requester auth;
- workshop form;
- tracking pages;
- emails;
- admin login;
- report headers where appropriate.

Responsive requirements:

- phone;
- tablet;
- desktop.

Accessibility:

- WCAG-friendly contrast;
- visible focus;
- semantic form labels;
- keyboard navigation;
- accessible error messaging;
- status not communicated through color alone.

### Verification

Test at common mobile and desktop widths.

Verify:

- forms usable on phone.
- tables degrade gracefully or become cards/scroll regions.
- QR code remains legible.
- logos retain aspect ratio.
- keyboard-only primary journeys work.

---

## Phase 29 — Security Hardening

### Goal

Review the system as an internet-facing application.

### Implement

Add/verify:

- Helmet headers;
- strict production CORS/origin policy;
- CSP suitable for the deployed frontend;
- HTTPS-only cookies;
- session rotation on authentication;
- CSRF defense for cookie-authenticated state-changing requests;
- request size limits;
- OTP rate limiting;
- admin login rate limiting;
- file upload limits;
- MIME validation;
- safe filenames;
- no public MinIO bucket;
- SQL injection protection through ORM and no unsafe raw queries;
- XSS-safe rendering;
- Markdown sanitization if used;
- security-sensitive logs redacted;
- tracking token entropy;
- generic auth error messages;
- secure secret handling;
- production startup failure if required secrets are missing.

Add a security regression test suite for authorization boundaries.

### Verification

Attempt:

- cross-workshop tracking access;
- cross-domain tracking access;
- requester calling admin endpoints;
- unauthenticated file download;
- ID/token tampering;
- reused OTP;
- expired OTP;
- brute-force OTP;
- malicious filename;
- XSS payload in text field;
- CSRF request.

All must fail safely.

---

## Phase 30 — Audit Log

### Goal

Make important administrative actions traceable.

### Implement

Create `audit_events`:

```text
id
actor_type
actor_admin_id nullable
actor_email nullable
action
entity_type
entity_id
metadata_json
request_id nullable
ip_address nullable
created_at
```

Audit at minimum:

- admin login;
- workshop approval;
- workshop decline;
- status override;
- budget change;
- funding adjustment;
- allowed-domain change;
- survey configuration change;
- request-type change;
- content change.

Do not put passwords, OTPs, session tokens, or full sensitive file payloads in metadata.

Admin view:

```text
/admin/audit
```

### Verification

- listed actions create events.
- actor is correct.
- metadata is useful but contains no secrets.
- audit entries are read-only from application UI.

---

## Phase 31 — Notification Outbox and Worker

### Goal

Make email delivery reliable instead of depending on request-response timing.

### Implement

Create `email_outbox`:

```text
id
template
recipient
payload_json
status
attempt_count
next_attempt_at
last_error nullable
created_at
sent_at nullable
```

Change business workflows to enqueue email records transactionally where appropriate.

Worker:

- claims pending emails;
- sends through SendGrid adapter;
- retries transient failures with backoff;
- marks permanent failures;
- logs safely.

At minimum migrate:

- OTP;
- creation confirmation;
- approval;
- decline.

For OTP, sending must still respect short expiry; failed/outdated OTP messages must not be delivered late after expiration.

### Verification

- SendGrid temporarily unavailable does not lose confirmation email.
- retries work.
- duplicate workers do not send the same outbox item twice under normal locking.
- permanently failed items can be inspected by admin/logs.

---

## Phase 32 — Reminder Notifications

### Goal

Add useful operational reminders without changing lifecycle truth.

### Implement

Configurable reminders:

- upcoming planned workshop;
- execution proof outstanding after scheduled end;
- follow-up outstanding;
- completion/outcome information outstanding.

Store notification event keys so the same reminder is not repeatedly sent.

Send reminders to the original creator email by default.

Do not automatically email arbitrary same-domain users.

### Verification

- due reminder sends once.
- not-yet-due reminder does not send.
- completed/declined workshops do not receive irrelevant reminders.
- retry does not create duplicate logical reminders.

---

## Phase 33 — Automated Test Coverage

### Goal

Build a reliable regression suite before production deployment.

### Backend integration tests

Cover:

- domain allow-list;
- creation OTP;
- tracking OTP;
- creator-domain access rule;
- workshop creation;
- approval;
- decline;
- funding;
- status transitions;
- execution submission;
- file authorization;
- survey repeatability;
- completion;
- reporting filters;
- admin authorization.

### Frontend tests

Cover:

- requester authentication;
- validation;
- request form;
- tracking auth;
- status-based UI;
- execution upload UI;
- survey;
- completion UI;
- admin approval/decline.

### End-to-end Playwright flows

Flow A:

```text
verify requester email
-> create workshop
-> receive tracking link
-> admin approve
-> open tracking link
-> same-domain OTP
-> view planned workshop
```

Flow B:

```text
automatic executed status
-> upload proof
-> submit execution
-> survey
-> enter opportunity
-> complete
```

Flow C:

```text
different-domain user opens leaked link
-> access denied
```

Flow D:

```text
admin filters reports
-> exports CSV
```

### Verification

- CI runs all tests.
- critical flows pass against fresh migrated database.
- tests do not depend on production services.

---

## Phase 34 — Production Docker Images

### Goal

Create deployable images.

### Implement

Multi-stage Dockerfiles.

API image:

- install production dependencies;
- build TypeScript;
- run non-root user;
- expose API;
- health endpoint.

Worker image:

- same code base where possible;
- separate command.

Web image:

- build static React assets;
- serve through Nginx or equivalent;
- SPA fallback configured;
- security headers coordinated with deployment.

Create `docker-compose.prod.yml` for reference deployment.

Do not package development secrets.

### Verification

- production images build from clean checkout.
- containers run as non-root where feasible.
- web deep links work after browser refresh.
- API health checks work.
- worker starts independently.

---

## Phase 35 — Migrations and Deployment Workflow

### Goal

Make schema deployment safe.

### Implement

Production deployment order:

```text
1. backup database
2. run migration job
3. verify migration success
4. deploy API
5. deploy worker
6. deploy web
7. run smoke tests
```

Do not have every API replica run migrations on startup.

Provide explicit command:

```bash
cd backend
npm run migration:run
```

Document rollback strategy:

- application rollback;
- forward-fix migration preference;
- database restore only for severe migration failure.

### Verification

- fresh environment can deploy.
- existing environment upgrades without data loss.
- app fails clearly if schema is incompatible.

---

## Phase 36 — CI Pipeline

### Goal

Prevent broken changes from reaching deployment.

### Implement

CI on pull request:

```text
install
lint
typecheck
unit tests
integration tests
build web
build api
build worker
```

On main/release branch additionally:

```text
build Docker images
optional vulnerability scan
publish images to registry
```

Cache dependencies safely.

Never expose deployment secrets to untrusted pull requests.

### Verification

- intentionally broken lint fails.
- type error fails.
- failing test fails.
- production build is exercised.

---

## Phase 37 — Observability and Operations

### Goal

Make failures diagnosable.

### Implement

Structured logs including:

- timestamp;
- level;
- service;
- request ID;
- route;
- response status;
- duration.

Do not log sensitive auth content.

Health endpoints:

```text
/live
/ready
```

Readiness checks:

- PostgreSQL connectivity;
- optionally object storage dependency where appropriate.

Track basic operational metrics if the hosting environment supports them:

- request count;
- error rate;
- latency;
- OTP send failures;
- email outbox failures;
- worker job failures.

Create a simple admin/system indicator for failed outbox messages if useful.

### Verification

- a failed request is traceable via request ID.
- database outage makes readiness fail.
- secrets remain redacted.

---

## Phase 38 — Backup and Data Retention

### Goal

Protect production data.

### Implement

Document and configure:

- PostgreSQL backups;
- restore procedure;
- object-storage backup/versioning strategy;
- retention rules;
- log retention;
- deletion process when client retention policy is supplied.

The client must eventually provide required retention periods.

Until then, do not automatically delete workshop records.

### Verification

In a non-production environment:

- restore database from backup.
- verify workshop relationships survive.
- verify file metadata still maps to object storage.

---

## Phase 39 — Final UX and Edge-Case Pass

### Goal

Resolve realistic cases before acceptance.

### Test and fix

- no funding requested;
- funding requested but zero/invalid amount;
- workshop in another timezone;
- daylight-saving transition;
- same customer with many workshops;
- long customer names;
- Unicode names and locations;
- declined workshop;
- workshop with no survey;
- multiple survey responses;
- execution with multiple files;
- completed workshop;
- invalid/expired tracking token;
- inactive admin;
- budget exhausted;
- object-storage outage;
- SendGrid outage;
- duplicate form submission;
- browser refresh mid-flow;
- expired session;
- mobile upload from camera/photo library.

### Verification

No critical workflow should dead-end without an actionable message.

---

## Phase 40 — Acceptance and Handover

### Goal

Confirm the full specification is delivered.

### End-to-end acceptance scenario

A Dell AE:

```text
1. enters john@dell.com
2. receives OTP
3. verifies OTP
4. submits an AI Envisioning workshop
5. receives workshop code, QR code, and tracking link by email
```

An admin:

```text
6. logs into admin
7. reviews the request
8. approves funding
9. workshop becomes planned
10. budget commitment is visible
```

A colleague:

```text
11. jane@dell.com receives or opens the tracking link
12. requests OTP
13. verifies OTP
14. can access the workshop
```

A non-authorized-domain user:

```text
15. user@gmail.com opens the same link
16. cannot gain access
```

After workshop time:

```text
17. worker moves planned -> executed
18. AE/CST uploads proof
19. enters actual attendance
20. submits execution
21. workshop moves to follow_up
22. one or more survey responses are submitted
23. leads/opportunities/pipeline are entered
24. actual funding is finalized
25. workshop is completed
```

Admin then:

```text
26. sees completed workshop in dashboard
27. filters it in reporting
28. exports CSV
29. downloads individual workshop report
30. sees correct program budget and ledger
31. can inspect status and audit history
```

All steps must work on desktop and mobile.

---

# 6. Core API Surface

The exact route naming may change, but keep the separation of public, requester, tracking, and admin authorization boundaries.

```text
GET    /api/health

POST   /api/public/request-access/send-otp
POST   /api/public/request-access/verify-otp
POST   /api/public/request-access/logout

GET    /api/requester/session
POST   /api/requester/workshops

POST   /api/public/workshops/:trackingToken/send-otp
POST   /api/public/workshops/:trackingToken/verify-otp

GET    /api/tracking/workshops/:trackingToken
POST   /api/tracking/workshops/:trackingToken/execution
POST   /api/tracking/workshops/:trackingToken/files
GET    /api/tracking/workshops/:trackingToken/files/:fileId
GET    /api/tracking/workshops/:trackingToken/survey
POST   /api/tracking/workshops/:trackingToken/surveys
POST   /api/tracking/workshops/:trackingToken/leads
DELETE /api/tracking/workshops/:trackingToken/leads/:leadId
POST   /api/tracking/workshops/:trackingToken/opportunities
DELETE /api/tracking/workshops/:trackingToken/opportunities/:opportunityId
POST   /api/tracking/workshops/:trackingToken/complete

POST   /api/admin/auth/login
POST   /api/admin/auth/logout
GET    /api/admin/auth/session

GET    /api/admin/workshops
GET    /api/admin/workshops/:id
POST   /api/admin/workshops/:id/approve
POST   /api/admin/workshops/:id/decline
POST   /api/admin/workshops/:id/status

GET    /api/admin/budget
GET    /api/admin/budget/ledger
POST   /api/admin/budget/adjust
POST   /api/admin/workshops/:id/funding

GET    /api/admin/domains
POST   /api/admin/domains
PATCH  /api/admin/domains/:id

GET    /api/admin/request-types
POST   /api/admin/request-types
PATCH  /api/admin/request-types/:id

GET    /api/admin/content
PATCH  /api/admin/content/:key

GET    /api/admin/survey/questions
POST   /api/admin/survey/questions
PATCH  /api/admin/survey/questions/:id

GET    /api/admin/reports/workshops
GET    /api/admin/reports/workshops.csv
GET    /api/admin/workshops/:id/report.pdf

GET    /api/admin/audit
```

---

# 7. Core Database Relationships

Conceptually:

```text
allowed_domains

admin_users

program_budgets
  └─ funding_ledger

workshops
  ├─ workshop_status_history
  ├─ workshop_funding
  ├─ workshop_execution
  ├─ workshop_files
  ├─ survey_submissions
  │    └─ survey_answers
  ├─ workshop_leads
  ├─ workshop_opportunities
  └─ audit_events

survey_questions
request_types
content_blocks

otp_challenges
email_outbox
```

Do not force repeated survey responses, files, opportunities, or status history into columns on `workshops`.

---

# 8. Session and Authorization Model

Keep three concepts separate.

### Requester creation session

Created after OTP against an active approved domain.

Purpose:

- create a new workshop.

Contains:

```text
verified_email
verified_domain
purpose=create_workshop
expires_at
```

### Workshop tracking session

Created after OTP from an email whose domain exactly matches the workshop's `creator_domain`.

Purpose:

- access one workshop.

Contains:

```text
verified_email
verified_domain
authorized_workshop_id
purpose=track_workshop
expires_at
```

### Admin session

Created after admin credentials.

Purpose:

- admin portal and admin APIs.

Contains:

```text
admin_user_id
purpose=admin
expires_at
```

Never treat one session type as another.

---

# 9. Important Authorization Invariants

These should have automated tests.

```text
A tracking token alone never returns workshop details.

A creator-domain OTP session for Workshop A cannot access a different-domain Workshop B.

A requester creation session does not grant admin access.

A requester creation session does not automatically grant tracking access unless the tracking authorization rule is explicitly performed.

A tracking session does not grant admin access.

A normal tracking user cannot approve/decline workshops.

A normal tracking user cannot change budget.

A normal tracking user cannot manually override status.

Only authorized users can access workshop proof files.

Admin access never depends on possession of tracking links.
```

---

# 10. Data Validation Rules

Recommended initial rules:

```text
requester_name: 1-150 chars
customer_name: 1-200 chars
location: 1-300 chars
duration_minutes: 15-1440
estimated_attendees: 1-10000
actual_attendees: 0-10000
description: max 10000 chars
execution_notes: max 10000 chars
decline_reason: 1-2000 chars
currency_code: ISO 4217 uppercase
country_code: ISO 3166-1 alpha-2
funding amounts: >= 0
pipeline values: >= 0
```

Use server validation as source of truth.

---

# 11. Date and Time Rules

Store:

```text
planned_start_at: UTC timestamp
timezone: IANA timezone, e.g. Europe/Berlin
duration_minutes: integer
```

Derive:

```text
planned_end_at = planned_start_at + duration_minutes
```

Display dates in the workshop's stored timezone.

Never infer lifecycle timing only from the admin browser's timezone.

---

# 12. Workshop Code vs Tracking Token

Keep them separate.

Example:

```text
workshop_code = AIW-2026-000123
tracking_token = 128+ bits of random URL-safe data
```

`workshop_code` is safe to display and search.

`tracking_token` is used in the public route and should not be sequential.

Neither replaces OTP authentication.

---

# 13. File Security Rules

Execution proof uploads must follow all of these:

```text
private bucket
random object key
size limit
MIME allow-list
filename sanitization
authorization before download
no executable content served inline
Content-Disposition set safely
metadata stored in PostgreSQL
```

If virus scanning is required by the deployment environment, insert it between upload and file availability. The storage abstraction should permit adding this later.

---

# 14. Email Templates Required

At minimum:

```text
OTP - workshop creation
OTP - workshop tracking
Workshop request confirmation
Workshop approved
Workshop declined
Upcoming workshop reminder
Execution follow-up reminder
Completion reminder
```

Every email should have plain-text and HTML alternatives.

Do not place sensitive workshop details in OTP emails before authentication unless the client explicitly approves that content.

---

# 15. Reporting Definitions

Use consistent definitions.

### Total workshops

Number of workshop records matching filters.

### Planned

Current status = `planned`.

### Executed

Current status = `executed`.

### Follow-up

Current status = `follow_up`.

### Completed

Current status = `completed`.

### Actual attendees

Sum of submitted execution actual attendee counts.

### Leads

Count of lead records.

### Opportunities

Count of opportunity records.

### Pipeline value

Sum of opportunity pipeline values in the program currency.

If future requirements allow multiple currencies, do not sum them without an explicit FX conversion model.

### Available budget

Calculated from program budget minus active committed/finalized consumption according to the funding ledger rules.

Never maintain dashboard totals manually in a separate mutable field if they can be derived safely from source records.

---

# 16. Environment Variables

Maintain `.env.example` without secrets.

Suggested variables:

```text
NODE_ENV
WEB_PORT
API_PORT

APP_BASE_URL
API_BASE_URL

DATABASE_URL

SESSION_SECRET
OTP_SECRET
OTP_TTL_MINUTES
OTP_MAX_ATTEMPTS
OTP_RESEND_COOLDOWN_SECONDS

SENDGRID_API_KEY
EMAIL_FROM

S3_ENDPOINT
S3_REGION
S3_ACCESS_KEY
S3_SECRET_KEY
S3_BUCKET
S3_FORCE_PATH_STYLE

PROGRAM_CURRENCY

MAX_UPLOAD_BYTES

ADMIN_BOOTSTRAP_EMAIL
ADMIN_BOOTSTRAP_PASSWORD

LOG_LEVEL
```

Bootstrap admin credentials are acceptable for local/dev bootstrap. Production should create/bootstrap the initial admin through a secure deployment process and then remove the plaintext bootstrap password from runtime configuration.

---

# 17. Definition of Done for Every Phase

A phase is not complete merely because the UI appears to work.

Every phase should satisfy:

```text
implementation committed
migration included if schema changed
backend validation included
authorization included
error states handled
tests added for new critical behavior
lint passes
typecheck passes
tests pass
build passes
manual verification completed
README updated if setup changed
```

---

# 18. Out of Scope Until Explicitly Requested

Do not silently expand the MVP into these systems:

```text
CRM synchronization
Salesforce integration
Microsoft Dynamics integration
Entra ID / Azure AD SSO
Dell SSO
public customer self-service accounts
multi-tenant white-labeling
real-time chat
calendar synchronization
video hosting
marketing automation
automatic currency conversion
complex BI warehouse
native mobile apps
```

The architecture should not block later integrations, but they are not required to complete the current specification.

---

# 19. Client Inputs Still Required Before Final Production Sign-Off

The application can be built using placeholders/configuration, but production sign-off requires the client to supply or confirm:

```text
approved public domain
approved requester email domains
Dell/Microsoft approved logo files and brand guidance
SendGrid email service configuration
final request types
final survey questions
program budget amount
program currency
acceptable execution-proof file types
final workflow/override policy
decline messaging expectations
required report formats
data retention policy
privacy/legal copy
production hosting/security requirements
admin bootstrap/SSO decision
```

Do not block engineering on these where configuration or placeholder content can be used safely.

---

# 20. Recommended Codex Workflow

Give Codex only one phase at a time.

For each phase, instruct it to:

```text
Read Project.md.
Implement only Phase N.
Do not begin later phases.
Preserve existing behavior.
Add or update tests for the phase.
Run lint, typecheck, tests, and build.
Report changed files, migrations, commands run, and any assumptions.
Do not mark the phase complete if verification fails.
```

After Codex finishes, manually run the verification checklist for that phase before moving to the next one.

If a phase reveals a necessary schema change for a future phase, prefer a minimal forward-compatible change rather than implementing the future phase early.

---

# 21. Final Product Success Criteria

The project is complete when all of the following are true:

```text
AE/CST users can verify an approved-domain email with OTP.
A verified AE/CST can create a workshop without creating an account.
The creator receives the unique tracking link by email.
The tracking link alone reveals no workshop data.
Any user from the creator's exact email domain can authenticate by OTP and access that workshop.
Other domains cannot access the workshop.
Admins can authenticate separately.
Admins can approve or decline requests.
Approved workshops follow the complete lifecycle.
Planned workshops automatically enter the executed phase after their scheduled end.
Execution proof and actual attendance are captured securely.
Survey submissions are repeatable.
Leads, opportunities, and pipeline are captured.
Funding is committed and finalized against an overall budget.
Budget changes are auditable.
Admins can inspect every workshop and its complete history.
Admins can filter and report across workshops.
Admins can export report data.
Admins can download an individual workshop report.
The application is responsive and Dell/Microsoft co-branded.
The system runs through Docker.
The database is managed through migrations.
Files are stored privately.
Email delivery is robust.
Critical workflows have automated tests.
Production images and deployment steps are documented.
Security boundaries are tested.
Backups and operational procedures are documented.
```

At that point the application fulfills the supplied workshop-management scope and is ready for client acceptance, subject to client-provided branding, content, reporting format, retention, and hosting requirements.
