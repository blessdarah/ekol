## Why

The Paper ERD now models the academic year as its own table (boards ERD 02/03/Finance, "WHAT CHANGED · 10 OCT") and moves class placement off `student` onto a per-year `enrolment` table. Our migrated schema still carries the old shape (year as text on `fee_plan`/`term.label`, `student.class_id`), so the database contradicts the design source of truth before any feature work starts.

## What Changes

- **BREAKING**: New `academic_years` table (school scope, UQ label per school, status planned/current/closed, one current per school via partial unique index). Migrations edited in place; `db:wipe` + fresh re-migrate (greenfield, no backfill).
- **BREAKING**: `terms` gains `academic_year_id` FK; new UQ `(academic_year_id, sequence)`; term label becomes bare "Term 1" with the year from its academic year.
- **BREAKING**: `students` loses `class_id` (class for a year lives on `enrolment`).
- **BREAKING**: `school_classes` gains `academic_year_id` FK; UQ becomes `(academic_year_id, level_id, name)` — next year's classes are new rows.
- New `enrolments` table: UQ `(student_id, academic_year_id)`; `school_class_id` nullable until placed (RESTRICT on class delete); status admitted/placed/enrolled/left; decision promote/repeat/leaving set in re-enrolment.
- **BREAKING**: `fee_plans.academic_year` free text becomes `academic_year_id` FK; UQ becomes `(school_id, level_id, academic_year_id)`.
- Term-dates-inside-year enforced at app level (cross-table rule, no declarative CHECK possible); `is_current` partial index on terms kept.

## Capabilities

### New Capabilities

- None (new tables fold into existing domains as ADDED requirements in the delta specs below).

### Modified Capabilities

- `tenant-core`: academic_year table added; term gains year FK + UQ and bare labels; student loses class_id.
- `academic-structure`: school_class gains year FK + widened UQ; new enrolment table with lifecycle statuses.
- `finance-ledger`: fee_plan year text becomes year FK with updated UQ.

## Impact

- Affected: `database/migrations/2026_10_09_00000{1,3,5,6,7}_*.php` (edited in place, no renumbering), `app/Models/{AcademicYear,Enrolment,Term,Student,SchoolClass,FeePlan,School}.php`, `app/Enums/{AcademicYearStatus,EnrolmentStatus,EnrolmentDecision}.php`, `tests/Feature/SchoolErdFoundationTest.php` (chain rewritten around year + enrolment).
- Unaffected domains: assessment-results, curriculum-coefficients, operations-audit (they hang off term/class/student rows that keep their identities).
- Requires `db:wipe` + `migrate:fresh`; existing dev data discarded (pre-release, per project instruction).
