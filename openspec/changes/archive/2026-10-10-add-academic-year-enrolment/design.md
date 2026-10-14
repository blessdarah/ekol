## Context

Paper ERD boards ERD 02 ("School, Year, Term, People"), ERD 03 ("Academic Structure & Enrolment") and Finance `fee_plan` were redrawn ("WHAT CHANGED · 10 OCT"): the year is now a table, class placement moved to a per-year `enrolment` table. The migrated schema (change `add-school-erd-foundation`, now archived with main specs) still has the old shape: `fee_plans.academic_year` text, `terms` without a year FK, `students.class_id`. The project instruction for this change is to edit the existing migration files in place (no new migration files) and rebuild via `db:wipe` + fresh migrate — valid because the project is pre-release with no production data.

## Goals / Non-Goals

**Goals:**

- `academic_years` table parented under `schools`, referenced by terms, fee plans, school classes and enrolments.
- `enrolments` carrying per-year class placement with the four-screen lifecycle (admitted → placed → enrolled, plus re-enrolment decisions).
- All edits in place in the five existing migration files; zero file renumbering.
- Foundation test rewritten around year + enrolment; pint + Pest green on both pgsql and sqlite.

**Non-Goals:**

- No backfill/data migration (wipe-and-rebuild per instruction).
- No enrolment UI, no registration bootstrap, no year rollover command (separate changes).
- No RLS or tenancy middleware changes (`BelongsToSchool` convention extends to the two new models as-is).
- Untouched domains: assessment-results, curriculum-coefficients, operations-audit.

## Decisions

- **Append `academic_years` to the schools migration file (000001) over renumbering.** The table depends only on `schools`, so it fits the existing Wave-1 file and every downstream file (000003+) keeps its timestamp. Alternative (insert 000002 + cascade renames) rejected as churn with no semantic gain.
- **Append `enrolments` to the students migration file (000006).** All three FK targets (years ←000001, classes ←000005, students ←same file, defined first) already exist at that point. Alternative (own file / Wave-4 group) rejected: enrolment is conceptually "the student's per-year row" and belongs with its parent.
- **`status`/`decision` as PHP string enums + pgsql CHECKs**, same convention as the foundation (model casts enforce on sqlite, CHECKs enforce on pgsql).
- **Timestamps follow the cards exactly:** `academic_years` gets `created_at` only (`$timestamps=false`, like other history-ish roots); `enrolments` gets full `timestampsTz` (placement/decision edits are the point of the table).
- **Term dates-inside-year enforced at app level** (Eloquent validation/observer + test), not declarative SQL — a CHECK cannot see the parent row. Same limitation class as the foundation's `SUM(installments)` rule.
- **`is_current` on terms kept alongside year `status=current`.** ERD retains both; the "who flips what on rollover" question stays open (see Open Questions) rather than being collapsed prematurely.
- **Enrolment `school_class_id` RESTRICT, `student/academic_year` CASCADE.** Deleting a class with placements must fail loudly; deleting a student or year cleans up its enrolment rows. Matches the ERD relationship note.

## Risks / Trade-offs

- [Risk] Editing migrations in place + wipe destroys dev data → Mitigation: pre-release project, explicit instruction; `db:wipe` is a conscious step in tasks, never automatic.
- [Risk] Foundation test and any future seeders referencing `student.class_id` break → Mitigation: test rewrite is a first-class task; grep for `class_id` on students after edits.
- [Risk] `fee_plan.academic_year` text → FK has no backfill path → Mitigation: none needed (wipe); noted so nobody copies this pattern post-launch.
- [Risk] Two "current" markers (year status, term flag) can disagree → Mitigation: documented open question; enforcement deferred to the rollover/registration change.

## Migration Plan

1. Edit the five migration files + models/enums/test in dependency order (tasks 1–4).
2. `php artisan db:wipe --force`, `migrate:fresh`, full `migrate:rollback` + re-migrate to prove reversibility.
3. `vendor/bin/pint` on touched paths, full Pest suite green (sqlite) — pgsql proven by the fresh migrate itself.
4. Rollback strategy: none beyond re-wipe (pre-release).

## Open Questions

- On year rollover/registration bootstrap, who sets `academic_years.status=current` and terms' `is_current` — admin action, command, or automatic on dates?
- Should closing a year database-enforce term immutability, or stay an app-level rule as specced?
