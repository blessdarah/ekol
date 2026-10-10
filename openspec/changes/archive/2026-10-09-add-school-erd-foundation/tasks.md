## 1. Environment and base

- [x] 1.1 Switch `.env` to `DB_CONNECTION=pgsql` with pgsql host/port/database and verify `php artisan migrate` connects
- [x] 1.2 Decide test DB strategy (pgsql vs sqlite) and update `phpunit.xml` / Pest config accordingly
- [x] 1.3 Add shared migration helpers: UUIDv7 PK (`$table->uuid('id')->primary()`), `timestamptz` convention, `BelongsToSchool` trait + global scope, PHP enums for role/cycle/state/kind/status/method

## 2. Wave 1 — roots

- [x] 2.1 Create `schools` migration + `School` model (UQ name, cycle check, soft deletes)
- [x] 2.2 Replace default users migration with UUID users (Option A merge: school_id, staff_code, role, initials, phone, is_form_master, invited_at, soft deletes) + `User` model with HasUuids

## 3. Wave 2 — tenant anchors

- [x] 3.1 Create `terms` + `Term` (partial unique one is_current per school)
- [x] 3.2 Create `levels` + `Level` and tenant-scoped `periods` + `Period`, `grade_bands` + `GradeBand`

## 4. Wave 3 — structure

- [x] 4.1 Create `school_classes` + `SchoolClass` (UQ level+name, form_master FK, RESTRICT), `series` + `Series`, `subjects` + `Subject`, `rooms` + `Room`
- [x] 4.2 Create `students` + `Student` (class_id NOT NULL, admission_no UQ, no credentials)

## 5. Wave 4 — junctions and price lists

- [x] 5.1 Create `student_series` + `StudentSeries` (UQ student+term), `coefficients` + `Coefficient` (UQ subject+level), `subject_teachers` + `SubjectTeacher` (single lead), `fee_plans` + `FeePlan`

## 6. Wave 5 — versions and headers

- [x] 6.1 Create `coefficient_versions` append-only + `invoices` (copied amount_due) + `assessments` state machine
- [x] 6.2 Second-pass migration: `coefficients.current_version_id` nullable FK + index

## 7. Wave 6 — leaves

- [x] 7.1 Create `assessment_subjects` (frozen coefficient), `marks` (absence check), `reports` immutable (void-and-reissue)
- [x] 7.2 Create `installments`, append-only `payments`, `timetable_slots` (UQ term+class+period+weekday), `attendance`, `teaching_logs`, `audit_events` (SET NULL actor, same-transaction writes)
- [x] 7.3 Verify full `migrate:fresh` + `migrate:rollback` per wave, run `vendor/bin/pint --dirty`, narrow Pest suite green
