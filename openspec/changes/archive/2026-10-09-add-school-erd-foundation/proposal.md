## Why

The Paper School System ERD page (6 artboards, 27 tables) is the agreed data shape, but the Laravel codebase still runs on MySQL with only default `users/cache/jobs` migrations. We need a Postgres + UUIDv7 foundation that matches the ERD before any feature screens can be built.

## What Changes

- **BREAKING**: Switch default DB connection from `mysql` to `pgsql` (env + docs; `config/database.php` already has pgsql block).
- Replace integer PKs with UUIDv7 PKs everywhere (`HasUuids` → `Str::uuid7()`, `$table->uuid('id')->primary()`).
- Merge ERD `staff` into Laravel `users` (Option A): single auth table with `school_id, staff_code, full_name, initials, email, role, phone, is_form_master, invited_at, password, deleted_at`.
- Create all 27 ERD tables across 6 domains, tenant-scoped by `school_id` — including `grade_band` and `period` (intentional divergence from ERD globals).
- Append-only/history tables use `created_at`-only (no `updated_at`); mutable tables use Laravel timestamps + `deleted_at` where ERD shows soft deletes.
- Enforce ERD checks as Postgres checks / partial unique indexes: one `is_current` term per school, `UQ(student_id,term_id)` on reports/series/invoices, `score <= max_score OR is_absent`, `SUM(installment)=amount_due` (app-level + transaction), void-and-reissue for reports.
- Migration waves ordered by FK dependency; circular `coefficient.current_version_id` added in a second pass.

## Capabilities

### New Capabilities

- `tenant-core`: school tenant root, term time anchor, unified users (staff), student records.
- `academic-structure`: levels, school_class (not `class`), series + per-term student_series junction.
- `curriculum-coefficients`: subjects, subject×level coefficient matrix, append-only coefficient_version, subject_teacher junction.
- `assessment-results`: assessment state machine, fan-out assessment_subject, marks, tenant-scoped grade bands, immutable reports.
- `finance-ledger`: fee plans, invoices (copied amount_due), installments, append-only payments (cash-office only).
- `operations-audit`: timetable slots + tenant-scoped periods, rooms, attendance, teaching logs, polymorphic audit_event.

### Modified Capabilities

- None (greenfield foundation; existing `users/cache/jobs` migrations superseded for `users` — see Impact).

## Impact

- Affected: `.env` (`DB_CONNECTION=pgsql`), `database/migrations/*` (new waves), `app/Models/*` (27 models + PHP enums), `database/factories/*`, `phpunit.xml` / Pest config (sqlite vs pgsql decision for tests).
- Existing `0001_01_01_000000_create_users_table` (int id, name/email/password) is replaced by UUID users table; `password_reset_tokens`/`sessions` kept as-is unless auth review says otherwise.
- No UI, no routes, no permissions system yet — `role` enum is forward-compatible placeholder for Spatie/policies later.
