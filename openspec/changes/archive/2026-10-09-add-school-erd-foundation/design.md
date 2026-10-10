## Context

Paper file `School System` (Paper MCP), ERD page `p-2-0`, 6 artboards: ERD 01 Overview, ERD 02 Core, ERD 03 Structure, ERD 04 Curriculum, ERD 05 Assessment, ERD 06 Finance+Ops. Conventions: PostgreSQL, multi-tenant by `school_id`, soft deletes, timestamps, uuid PKs. Current Laravel 13 (PHP 8.5) repo: `DB_CONNECTION=mysql`, single `User` model (int id), 3 default migrations. `pdo_pgsql` available. Architecture page describes Remix/Postgres intent — followed for data intent only, not stack.

Explored with user: Postgres yes, Laravel users + role yes (Option A merge), UUIDv7 yes, full tenant scoping yes, append-only without `updated_at` yes, ordered migrations yes. Parked: guardian table, term promotion, payment gateway.

## Goals / Non-Goals

**Goals:**
- One Postgres schema implementing all 27 ERD tables with ERD columns, UQs, checks, and relationships.
- Single `users` auth (Option A) with `role` enum covering `principal, academic_lead, teacher, form_master, admin, accountant`.
- UUIDv7 PKs via `HasUuids` (framework default `Str::uuid7()`), native `uuid` columns.
- Tenant isolation: `school_id` on every tenant table including `grade_band`, `period`; global scope + `BelongsToSchool` convention.
- Correct timestamp matrix: mutable tables get `created_at/updated_at/(deleted_at)`; history tables get single time column only.
- FK-safe migration waves 1–6 + second-pass circular FK.

**Non-Goals:**
- No guardian table (guardian stays text on student) — parked.
- No term-to-term promotion/carryover — parked.
- No payment gateway/provider columns — cash-office `cash,bank_transfer,mobile_money,cheque` only — parked.
- No permissions/ACL system, no UI/routes/controllers, no RLS policies yet (noted as follow-up).
- No seed data beyond what tests need.

## Decisions

- **Postgres over MySQL/sqlite:** ERD needs `timestamptz`, `numeric(p,s)`, `jsonb`, partial uniques. Alternative `mysql` rejected (check/partial-index divergence). `config/database.php` pgsql block reused; only `.env` changes. Tests: recommend pgsql for feature tests (sqlite would silently skip Postgres features) — still open, see Questions.
- **Option A merge (users absorbs staff) over B (users+staff 1:1):** chosen by user. Rationale: one login type, fewer joins, all ERD `staff_id` FKs (`school_class.form_master_id`, `subject_teacher.staff_id`, `mark.entered_by`, `payment.received_by`, `audit_event.actor_id`, `student_series.chosen_by`) become `users.id`. Tradeoff: `users` table is wider; if student/guardian login ever appears, revisit B. `password_hash` → Laravel `password` (hashed cast), `invited_at` kept.
- **UUIDv7 over v4/int:** user asked "aren't uuids better — use time-ordering". Confirmed `HasUuids::newUniqueId()` = `Str::uuid7()` on Laravel 13. App-generated, stored as Postgres `uuid`. Rejected ints (enumeration, merge pain) and v4 (random fragmentation, no ordering).
- **Scope globals too:** ERD marks `grade_band`, `period` as global; user overrode to tenant-scoped with `school_id` + `UQ(school_id, letter)` / `UQ(school_id, ordinal)`. Rationale: per-school bell schedules and grading policy. Divergence recorded here so ERD stays source of intent, not literal.
- **Timestamps:** mutable = `$table->timestampsTz() + softDeletes()`; history = single `$table->timestamptz('changed_at|received_at|occurred_at|chosen_at|published_at')->useCurrent()` with `$timestamps=false` on model. `report` gets `published_at + voided_at null`, no `deleted_at` (void-and-reissue). `coefficient_version/coefficient` pair: version rows append-only, `current_version_id` nullable pointer.
- **Enums:** PHP backed string enums + Postgres `check` constraints (not native PG enum type — easier Laravel migrations/rollbacks). `cycle`, `role`, `gender`, `assessment.state/kind`, `invoice/installment.status`, `payment.method`, `attendance.status`, `room.kind`, `subject_teacher.role`, `coefficient.status`.
- **Money/grades:** `numeric(10,2)` invoices/payments, `numeric(3,1)` coefficients/weights, `numeric(5,1)` marks — never float. Balance = `due - SUM(payments)` computed, never stored.
- **Migration waves (FK-safe):** 1 school → 2 term/level/users/period/grade_band → 3 school_class/series/subject/room + student → 4 student_series/coefficient/subject_teacher/fee_plan → 5 coefficient_version/assessment/invoice (+ second-pass `current_version_id`) → 6 assessment_subject/mark/report/installment/payment/timetable_slot/attendance/teaching_log/audit_event. `school_class` named to avoid `class` reserved word.

## Risks / Trade-offs

- [Risk] Existing `users` migration (int id) conflicts with new UUID users → Mitigation: replace migration, fresh `migrate:fresh` on dev; document **BREAKING** for any existing data.
- [Risk] `SUM(installments)=amount_due` and `score<=max_score` can't be pure declarative checks under concurrency → Mitigation: check constraint where possible + transactional app validation + test coverage.
- [Risk] Partial unique `one is_current per school` needs Postgres partial index (`where is_current`) — Laravel `unique()` can't express it → Mitigation: raw `DB::statement('CREATE UNIQUE INDEX ... WHERE is_current')` in migration.
- [Risk] Polymorphic `audit_event(entity, entity_id)` has no FK → Mitigation: convention + index `(entity, entity_id)`, never update/delete rows.
- [Risk] UUIDv7 URLs are verbose → Mitigation: accept; use route-model binding, no increment fallback.
- [Risk] Tenant scope forgotten on new query → Mitigation: global scope + middleware school resolution + `school_id` on every query test.

## Migration Plan

1. Land waves 1–6 in order on fresh Postgres DB (`php artisan migrate:fresh`), verify `migrate:rollback` per wave.
2. Deploy: `DB_CONNECTION=pgsql` env, run migrations at deploy, no backfill (greenfield).
3. Rollback: standard `down()` drops in reverse; circular FK dropped first.
4. Follow-ups (separate changes): RLS as backstop, factories/seeders, permissions, tests on pgsql.

## Open Questions

- Tests: pgsql-only or sqlite for unit + pgsql for feature? (Recommend pgsql to match partial indexes/jsonb.)
- Keep Laravel `password_reset_tokens`/`sessions` tables as-is with UUID `users.id` (`sessions.user_id` type change)?
- `student.class_id NOT NULL` + `RESTRICT` on class delete — confirm restrict vs cascade for all parent deletes?
