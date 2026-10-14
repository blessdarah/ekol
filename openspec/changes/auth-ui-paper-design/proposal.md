## Why

The auth flow works end-to-end but its pages are unstyled placeholders (generic black/gray), while Paper screens 10–16 define a complete visual system: 440px brand panel with stepper/statement/school-identity variants, Inter Tight display type, deep-green primary actions, segmented selectors, and split code boxes. Shipping placeholders would discard the agreed design and force a rewrite later.

## What Changes

- Restyle all 7 auth screens (10–13 registration, 14 find-school, 15–16 sign-in + error) to the Paper system behind a shared `AuthLayout` (brand panel variants + privacy note + Campus wordmark).
- Screen-true controls: slug field with `.parent-domain` suffix + live availability caption, ownership and subsystem segmented selectors, Region select + Town, password strength meter, authorisation checkbox, six split code boxes with resend countdown, details rows with copy button, up-next steps, school identity block, remember checkbox, show/hide password, error banner.
- **Backend gaps the design exposes**: `schools.ownership` (government/mission/private); `region` + `town` replacing single `location`; authorisation `accepted` validation; SMS-instead and change-email endpoints; workspace-details email on bootstrap; remember-me passthrough; dynamic parent domain prop (no hardcoded suffix); ready button targets school login URL; forgot-password placeholder page (reset flow itself stays deferred).
- **BREAKING (schema)**: in-place migration edits + wipe/rebuild per pre-release convention.

## Capabilities

### New Capabilities

- `auth-ui-paper`: Paper-faithful UI for auth screens 10–16 on shared layout + tokens.

### Modified Capabilities

- `tenant-core`: schools gains ownership/region/town (location removed), users phone per-school UQ and slug already covered by pending deltas — this delta restates the full final schools/users requirements so archive order stays clean (see design).

## Impact

- Affected: `resources/js/pages/auth/*`, new `resources/js/layouts/auth-layout.tsx` (+ stepper/segmented/code-box components), `resources/js/pages/{dashboard,setup}.tsx` untouched; `2026_10_09_000001` (schools columns) + `000002` (nothing new — validation only); `RegistrationController`/`LoginController` additions; `School` (fillable + ownership const); one placeholder forgot-password page.
- Archive order dependency: `add-academic-year-enrolment` → `add-school-registration-auth` → this change (deltas stack; see design).
- Deferred: full password-reset flow, School Setup screen (08), dashboard (01).
