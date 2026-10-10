## Context

Paper screen 08 defines six setup zones; the codebase has the admin shell, domain tables, and stub setup page, but no setup endpoints, no logo storage, no installment templates, no window dates, and no weekday config. Stored under `auth-ui-paper-design` (in progress, disjoint files) and `admin-shell-skeleton` (complete) — this change touches new setup files plus in-place migration edits, composing cleanly with both.

## Goals / Non-Goals

**Goals:**
- Six autosaved zones on the existing admin shell, token-faithful to screen 08.
- Installment template table + materialization + oldest-first rule specced for the future payment flow.
- Logo lifecycle (upload, validate, serve to login/cards/receipts).
- Both immutability rules enforced at validation + model layers with disabled UI states.

**Non-Goals:**
- No timetable generation (consumes periods/weekdays later), no dashboard content, no password-reset.
- No school-switcher behavior, no role-based setup visibility (founding admins and later admins share the page).
- No backfill (pre-release wipe/rebuild); no new design tokens.

## Decisions

- **Autosave as debounced per-zone PATCH endpoints** (one controller, one method per zone) over a single form + Save buttons. Rationale: Paper header mandates it; zones are independent aggregates. Alternative rejected per explicit user direction.
- **Audit at save granularity, not keystroke.** Each debounced save writes one audit row with the field diff; keystrokes never reach the audit table. Rationale: keystroke audit would flood `audit_events` within a day.
- **Template rows `(school, year, seq, percent)` over JSON columns.** Rows keep the UQ + percent-sum check declarative and the materialization query trivial. Alternative (percents array on school/year) rejected — weaker constraints, harder diffs.
- **Template scope school+year, not per fee-plan.** Screen says "Applies to every student"; amounts still derive per-plan at issue time. If levels ever diverge, revisit — recorded, not solved.
- **Weekdays as `schools.school_days` smallint bitmask (Mon=1 … Sun=64).** Single column, no join, trivial pill UI mapping. Alternative (weekday rows table) rejected as over-modeled for 7 fixed flags.
- **Window dates as `window_starts_on`/`window_ends_on` on assessments**, nullable until scheduled; marks entry checks containment. Alternative (reusing single `scheduled_for`) rejected — design shows ranges, and a point cannot express a window.
- **Logo on `public` disk under `logos/{school_id}/`, `schools.logo_path` nullable.** Served directly for login/cards/receipts; validation (PNG/SVG, square, ≥256px) server-side via image rules + dimension check. Alternative (media library package) rejected — one file per school needs no library.
- **Slug guarded at three layers**: excluded from validation rules (never accepted), model `saving` guard throwing on change, UI renders it read-only. Terms-with-marks guarded at validation + model `saving` + disabled UI with reason.

## Risks / Trade-offs

- [Risk] Autosave races (two zones, slow network) → Mitigation: per-zone independent endpoints share nothing; last-write-wins per column is acceptable pre-collaboration.
- [Risk] Editing term dates after attendance (not marks) exists → Mitigation: lock triggers on marks only per decision; attendance-only terms stay editable (documented narrowing).
- [Risk] Percent-sum validation on partial template edits → Mitigation: validate the full set server-side on every template save, not per-row.
- [Risk] Logo files orphaned on replace → Mitigation: delete-on-replace in the upload path; covered by a test.

## Migration Plan

1. In-place migration edits (schools logo/school_days, assessments windows, new template table) + models + controller + pages.
2. `db:wipe` + fresh, rollback cycle, `npm run build`, Pest + pint + phpstan-7 green.
3. Rollback: re-wipe (pre-release).

## Open Questions

- Year creation UI from Setup: modal with dates, or inline row? (Default: inline "+ New academic year" row expanding date inputs per design.)
- Rollover ownership (who flips `current`): Setup action vs separate command — still open from prior change; Setup's year selector must not accidentally answer it.
