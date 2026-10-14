## Context

Paper screens 10–16 (verified via tree reads + screenshots of 10 and 15) define the auth visual system; current pages are unstyled placeholders. Exact per-node values (spacing, type scale, icon SVGs) are read with `get_jsx`/`get_computed_styles` during implementation — the file's token set (primary #0E4D3A, primary-tint, border, Inter Tight/Inter) already matches the screenshots. Two prior changes are implemented but unarchived (`add-academic-year-enrolment` 9/9, `add-school-registration-auth` 11/11); this change's delta composes after theirs.

## Goals / Non-Goals

**Goals:**

- All 7 auth screens visually faithful to Paper on one shared layout + token-driven classes.
- Backend gaps closed: ownership/region/town columns, authorisation validation, SMS-instead + change-email endpoints, ready-details email, remember-me, dynamic parent domain, ready→school-login target, forgot-password placeholder.
- Zero visual-regression risk to the app shell: only `auth/*`, `dashboard`, `setup` pages touched.

**Non-Goals:**

- No full password-reset flow (placeholder page only), no screen 08/01 builds, no dashboard/setup content.
- No new design tokens (file set suffices); no responsiveness work beyond the 1440px frames (mobile follow-up).
- No visual snapshot testing (Pest asserts props/content, not pixels).

## Decisions

- **Shared `AuthLayout` + small components over per-page shells.** `layouts/auth-layout.tsx` (brand panel with `variant: stepper | statement | identity`, privacy note, wordmark) plus `stepper.tsx`, `segmented.tsx`, `code-boxes.tsx`. Rationale: all 7 screens share the shell; variants cover the only differences. Alternative (duplicate markup per page) rejected as drift-prone.
- **`location` replaced by `region` + `town`, plus `ownership`.** Screen 10 shows Region select + Town text and ownership segments; the single `location` text cannot render the design. `region`/`town` nullable strings, `ownership` required string + pgsql check (government/mission/private, default government per preselected design). Alternative (keep location, ignore design fields) rejected — it would silently drop user input.
- **Subsystem values fixed to the design trio** (anglophone/francophone/bilingual) via controller `Rule::in`; column stays free text (ERD shows plain enum, no stricter need).
- **Authorisation checkbox validated `accepted`, never stored.** Legal attestation at submit time; no column (nothing to query later).
- **SMS-instead = channel flip + reissue; change-email = payload patch + reissue.** Two tiny endpoints reusing the pending-row machinery; no new tables. SMS delivery stays logged-stub (provider deferred, as before).
- **Ready email via `Mail::raw` summary** in bootstrap completion path (log driver in dev); keeps the "we also emailed you" promise without a Mailable class.
- **Remember-me passed to `Auth::login($user, $remember)`.** One-line controller change honoring the screen 15 checkbox.
- **Parent domain from `APP_URL` host passed as page prop.** Kills the hardcoded `.ekol.test` suffix; prod sets `APP_URL=https://campus.cm` and suffixes render `.campus.cm` per design.
- **Ready button targets the school login URL**, not dashboard (design-correct; session already authenticated so it lands signed-in).
- **Archive order: academic-year → registration-auth → this change.** Each delta restates full final blocks so sequential application converges; honor the order or specs diverge.

## Risks / Trade-offs

- [Risk] Pixel-fidelity without snapshot tests drifts → Mitigation: token-driven classes + reviewer screenshot pass against Paper frames in tasks.
- [Risk] Three stacked tenant-core deltas conflict if archived out of order → Mitigation: explicit order above; each delta is full-block so any order still parses, but final state assumes this sequence.
- [Risk] `ownership` required blocks pre-existing dev rows → Mitigation: pre-release wipe/rebuild convention; no backfill needed.
- [Risk] Code-box UX (6 split inputs vs one) complicates typing/paste → Mitigation: single backing value with paste support and auto-advance; degrades to one input gracefully.

## Migration Plan

1. In-place migration edits (schools columns) + model/controller/page work per tasks.
2. `db:wipe` + fresh, rollback cycle, `npm run build`, Pest + pint + phpstan-7 green.
3. Screenshot review of all 7 pages against Paper frames before calling done.
4. Rollback: re-wipe (pre-release).

## Open Questions

- Cameroon region list for the Region select: hardcode the 10 regions or free text with datalist? (Default: hardcoded 10-region select.)
- Student-ID-format config (`GBHS-25-0001`): derived display `{CODE}-{YY}-0001` for now; real format settings belong to screen 08.
