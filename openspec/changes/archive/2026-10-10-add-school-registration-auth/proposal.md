## Why

The database foundation (schools, users, years, enrolments) exists but no human can enter the system: there are no registration, verification, tenancy-resolution, or sign-in flows. Paper screens 09–16 define exactly this access flow, and without it the product is unreachable.

## What Changes

- School registration (screens 10–13): workspace details with live slug availability check → administrator account staging → 6-digit verification code (10-min expiry, attempt limits, resend, SMS fallback) → workspace-ready bootstrap creating school + admin user + academic year + terms in one transaction. Nothing is persisted until the email is verified (staged payload lives on `pending_registrations`).
- Subdomain tenancy: `schools.slug` (globally UQ) resolves the current school from the request host; session data is scoped to that school; the general sign-in keeps a find-school step while school addresses skip it.
- Sign-in (screens 14–16, 01): school-branded login accepting email **or** phone, session limited to the school's data; first admin visit routes to School Setup.
- **BREAKING (schema)**: `schools` gains `slug` UQ; `users.phone` becomes UQ per `(school_id, phone)`. Email stays globally unique (status quo; multi-school membership deferred — see Impact).

## Capabilities

### New Capabilities

- `school-registration`: staged school + admin capture, verification codes, verified bootstrap transaction.
- `subdomain-tenancy`: slug resolution middleware, session school scope, find-school vs own-address behavior.
- `school-sign-in`: branded login with email-or-phone credentials, school-scoped sessions, first-visit setup routing.

### Modified Capabilities

- `tenant-core`: schools gains slug; users phone becomes per-school unique.

## Impact

- Affected: `database/migrations/2026_10_09_00000{1,2}_*.php` (edited in place + wipe/rebuild, pre-release convention), new `AcademicYear`-style models (`PendingRegistration`, `VerificationCode` — or single table per design), `app/Http/Controllers/Auth/*`, `app/Http/Middleware/ResolveSchool.php`, `routes/web.php`, new Inertia React pages for screens 10–16, mail + SMS notification channels.
- Deferred (open): whether email goes per-school for multi-school humans (sidebar switcher hints yes); SMS provider choice; password-reset flow; role-based permissions (role enum remains a placeholder).
