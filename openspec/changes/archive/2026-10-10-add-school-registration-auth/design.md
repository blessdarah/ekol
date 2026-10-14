## Context

Paper screens 09–16 define the access flow: school registration (10–12) → workspace ready (13) → find school (14) → branded sign-in (15–16) → dashboard or setup (01/08). The database has `schools`/`users` but no slug, no staged-registration store, no tenant resolution, and no auth endpoints (no Breeze/Fortify/Sanctum installed). Prior explore decisions locked: slug approach (1a), auditable pending-registrations table (2b), per-school phone uniqueness (4), subdomain tenancy (5). Email scope stays global (status quo; multi-school membership deferred).

## Goals / Non-Goals

**Goals:**

- End-to-end registration for a new tenant per screens 10–13, verified before anything persists.
- Subdomain-resolved tenancy with session-scoped data access.
- Branded email-or-phone sign-in with safe error states and first-visit setup routing.
- All decisions traceable to the explore session; new schema limited to `slug` (+ nullable `location` from screen 10), phone UQ, `setup_completed_at`, and the staging table.

**Non-Goals:**

- No password-reset flow, no role-based permissions UI (role remains a placeholder enum).
- No SMS provider integration beyond a logged fallback channel (provider choice deferred).
- No multi-school membership for one human (one row per school; shared email across schools stays rejected).
- No School Setup screen (08) build-out beyond the first-visit redirect target.

## Decisions

- **Single `pending_registrations` table over session-only staging.** One row holds the school payload (JSONB), admin payload (JSONB, password hashed at stage time), code hash, channel, attempts, expires_at. Rationale: auditable, survives browser close, resend ratio-limited naturally. Alternative (session/cache) rejected per explore decision 2b.
- **Code hash, not plaintext.** `hash('sha256', $code)` stored; comparison in constant time. Attempt counter incremented per try; row invalidated past limit or expiry.
- **Bootstrap in one DB transaction** creating school → academic year + terms (3 seeded terms per ERD default or screen-10 input — screen read during implementation) → admin user → mark registration consumed. Any failure rolls back everything.
- **Subdomain via `ResolveSchool` middleware** reading the first host segment, loading `School::where('slug')`, binding into the container + session; 404 on unknown slug. General sign-in route exempted (find-school step). Alternative (path-prefix tenancy) rejected per explore decision 5.
- **Credential resolver tries email, then per-school phone.** Phone lookup scoped to the resolved school (`where school_id + phone`); email global. Keeps Laravel's session guard; custom `AttemptToAuthenticate`-style controller logic instead of Fortify (no new dependency for a two-screen flow).
- **Phone UQ `(school_id, phone)` declarative; email UQ stays global.** Matches decided scope; the sidebar-switcher multi-school case is recorded as a follow-up, not solved here.
- **First-visit flag on users** (`setup_completed_at` nullable? or derive from School Setup state) — simplest honest option: nullable `setup_completed_at` on users set when setup finishes; redirect while null for admins. Deferred to implementation detail but recorded so tasks include it.

## Risks / Trade-offs

- [Risk] Subdomain routing in local dev needs wildcard host config → Mitigation: `.env` `APP_URL` + `/etc/hosts` entries documented in tasks; session `domain` set to parent host.
- [Risk] Reserved slugs (`www`, `api`, `admin`, `mail`) collide with infra → Mitigation: reserved-word blocklist validated at stage time and DB-check level.
- [Risk] SMS fallback without a provider is a dead branch → Mitigation: channel logged via notification channel abstraction; provider swap is one class later.
- [Risk] Stale pending rows accumulate → Mitigation: scheduled prune of expired rows (tiny `schedule:prune` command in tasks).
- [Risk] Email enumeration via "already registered" message → Mitigation: accepted trade-off (design explicitly requires it); generic messages everywhere else.

## Migration Plan

1. In-place migration edits (`schools.slug`, phone UQ, `pending_registrations`) + `db:wipe` + fresh (pre-release convention).
2. Middleware + controllers + Inertia pages behind new routes; no changes to existing routes except grouping school-address routes under middleware.
3. Verify: Pest feature tests for staging/verify-attempt-limits/bootstrap-atomicity/subdomain-404/phone-login; pint; phpstan level 7 (project now enforces zero errors).
4. Rollback: re-wipe (pre-release).

## Open Questions

- Bootstrap terms: fixed 3-term seed or screen-10 input? (Read screen 10 during implementation; default to 3 seeded terms.)
- `setup_completed_at` vs deriving setup state from school settings — confirm when screen 08 is read.
- Email per-school uniqueness for multi-school humans — deferred follow-up change.
