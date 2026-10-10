## 1. Schema (edit in place + wipe/rebuild)

- [x] 1.1 Edit `2026_10_09_000001_create_schools_table.php`: add nullable `logo_path` + `school_days` smallint default 62 (Mon–Sat); update `School` (fillable, docblock, saving guard rejecting slug changes)
- [x] 1.2 Edit `2026_10_09_000008_...assessments...php`: add nullable `window_starts_on`/`window_ends_on` to assessments; update `Assessment` + term-lock guard (reject date/sequence edits when marks exist)
- [x] 1.3 New `fee_installment_templates` table in the 000007 file (school + year FKs, seq, percent numeric(5,2), UQ school+year+seq, percent-sum validated app-side); create `FeeInstallmentTemplate` model

## 2. Setup endpoints + page

- [x] 2.1 `SetupController` with per-zone PATCH endpoints (profile incl. logo upload w/ dimension validation + delete-on-replace, year selector + creation, installments template save, windows save, schoolday save) + audit rows at save granularity
- [x] 2.2 Setup page on admin shell with six autosaved zones (debounced inputs, inline errors, saved indicators, disabled states with reasons for locked terms); logo uploader, weekday pills, periods editor, windows editor

## 3. Rules + verification

- [x] 3.1 Materialization helper (template → installments at invoice issue) + oldest-first payment application rule as tested domain logic (wired into future record-payment flow, proven now by unit tests)
- [x] 3.2 Pest coverage (autosave zones, logo validation + replace, template sum validation, window containment, slug/term-lock rejections incl. hand-crafted requests, materialization math, oldest-first) + `npm run build` + screenshot pass vs screen 08 + pint + phpstan level 7 + full suite green
