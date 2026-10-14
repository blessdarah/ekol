## Why

School Setup (Paper screen 08) is the first-visit landing for every founding admin and the single place where school identity, years, fee splits, assessment windows, and the school day are configured — yet nothing behind it exists: no logo storage, no installment templates, no window model, no weekday config, and no edit guards. Without it, onboarding stalls at a stub page and every downstream flow ingests unconfigured defaults.

## What Changes

- School Setup page with six autosaved zones (profile, academic year & terms, fee installments, sequences & exams windows, school day) inside the admin shell; every zone debounces and saves independently with inline validation.
- Logo upload (PNG/SVG, square, ≥256px, server-validated) stored per school and consumed by login, report cards, and receipts.
- `fee_installment_templates` (school + year + seq + percent, summing to 100): count stepper + splits UI; materialized into per-invoice installments at issue time; payments fill the oldest unpaid installment first (rule specced here, enforced in the future record-payment flow).
- Assessment windows with date ranges + status pills, backed by window start/end on assessments.
- School-day config: weekday pills plus periods CRUD (tenant `periods` table already exists; weekdays need a home — decided in design).
- Immutability: slug excluded from all update paths (model guard backstop); terms with any marks reject date/sequence edits and render disabled with reason.
- Academic-year creation from Setup, composed with (not replacing) the open rollover question.

## Capabilities

### New Capabilities

- `school-setup`: setup page zones, autosave endpoints, logo upload, installment templates + materialization, assessment windows, school-day config, edit guards.

### Modified Capabilities

- `tenant-core`: schools gains logo path (nullable); terms gain edit-lock semantics when marks exist.
- `finance-ledger`: invoices materialize installments from templates; payments apply oldest-first.

## Impact

- Affected: `schools`/`assessments` migration edits (in-place + wipe/rebuild, pre-release convention), new `fee_installment_templates` table, `SetupController` (+ per-zone PATCH endpoints), Inertia setup pages/components, file storage config, audit granularity for autosaves.
- Untouched: auth screens, admin shell, all other domain tables, existing tests (suite extended).
- Deferred: full password-reset, dashboard content, timetable generation (consumes periods/weekdays later).
