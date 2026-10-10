## 1. Schema (edit in place + wipe/rebuild)

- [x] 1.1 Edit `2026_10_09_000001_create_schools_table.php`: add `slug` string globally UQ (+ reserved-word guard note); update `School` (fillable + docblock)
- [x] 1.2 Edit `2026_10_09_000002_create_users_table.php`: phone UQ per `(school_id, phone)`; add nullable `setup_completed_at`; update `User` (fillable + casts)
- [x] 1.3 Append `pending_registrations` to the 000002 users file (school payload JSONB, admin payload JSONB, code hash, channel, attempts default 0, expires_at, consumed_at nullable, created_at only); create `PendingRegistration` model

## 2. Subdomain tenancy

- [x] 2.1 Create `ResolveSchool` middleware (subdomain → school binding, 404 unknown, exempt general routes); register + group school-address routes; document local wildcard-host setup
- [x] 2.2 Wire session school scope (current school in session; cross-school denial test)

## 3. Registration flow (screens 10–13)

- [x] 3.1 Staging endpoints: school payload with live slug check + admin payload with duplicate-email guard; code issue (hash, 10-min expiry, mail channel, SMS-logged fallback)
- [x] 3.2 Verify endpoint: attempt limits, expiry + resend; bootstrap transaction (school → year + terms → admin user → consume row); workspace-ready data
- [x] 3.3 Inertia pages for screens 10–13 + scheduled prune of expired pending rows

## 4. Sign-in flow (screens 14–16, 01)

- [x] 4.1 Branded login accepting email or per-school phone; generic error state (no enumeration); session scoped to school
- [x] 4.2 First-visit routing to School Setup for unset-up admins; dashboard otherwise
- [x] 4.3 Pest coverage (staging nothing-persisted, attempt limits, atomic bootstrap, subdomain 404, phone login, cross-school denial) + pint + phpstan level 7 green + full suite green
