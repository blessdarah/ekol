## 1. Academic year root (edit 000001 in place)

- [x] 1.1 Append `academic_years` table to `2026_10_09_000001_create_schools_table.php` after `schools` (school_id FK cascade, label, UQ school+label, starts_on/ends_on, status default planned + pgsql check, partial unique current per school, created_at only); create `AcademicYear` model + `AcademicYearStatus` enum
- [x] 1.2 Add `academicYears()` relation to `School`; verify `php artisan migrate --force` passes on pgsql

## 2. Terms + students (edit 000003/000006 in place)

- [x] 2.1 Edit `2026_10_09_000003_create_terms_table.php`: add `academic_year_id` FK cascade + UQ (academic_year_id, sequence); update `Term` (fillable + `academicYear()` relation, keep school scope and is_current index)
- [x] 2.2 Edit `2026_10_09_000006_create_students_table.php`: drop `class_id` from `students`; append `enrolments` table (student/year FKs cascade, school_class_id nullable RESTRICT, UQ student+year, status + check, decision nullable + check, timestampsTz); create `Enrolment` model + `EnrolmentStatus`/`EnrolmentDecision` enums; update `Student` (remove class_id/schoolClass, add enrolments())

## 3. Classes + fee plans (edit 000005/000007 in place)

- [x] 3.1 Edit `2026_10_09_000005_..._school_classes_...php`: add `academic_year_id` FK cascade to `school_classes`, widen UQ to (academic_year_id, level_id, name); update `SchoolClass` (fillable + `academicYear()`/`enrolments()` relations)
- [x] 3.2 Edit `2026_10_09_000007_..._fee_plans_...php`: replace `academic_year` text with `academic_year_id` FK restrict, UQ (school_id, level_id, academic_year_id); update `FeePlan` (fillable + `academicYear()` relation)

## 4. App-level rules + verification

- [x] 4.1 Enforce term-dates-inside-year at app level (validation/observer) with a Pest test proving out-of-range dates are rejected
- [x] 4.2 Rewrite `tests/Feature/SchoolErdFoundationTest.php` around year + enrolment (year → term/class/fee plan → student → enrolment → mark/invoice/payment chain)
- [x] 4.3 Rebuild + verify: `db:wipe --force`, `migrate:fresh`, full `migrate:rollback` + re-migrate, `vendor/bin/pint` on touched paths, full Pest suite green
