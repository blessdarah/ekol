## 1. Schema + tokens (edit in place)

- [x] 1.1 Edit `2026_10_09_000001_create_schools_table.php`: replace `location` with nullable `region` + `town`, add `ownership` string default government + pgsql check; update `School` (fillable, docblock, ownership const list)
- [x] 1.2 Pull exact per-node values via Paper `get_jsx`/`get_computed_styles` for the 7 screens (spacing, type, icon SVGs for logo/arrow/check)

## 2. Shared layout + components

- [x] 2.1 Create `resources/js/layouts/auth-layout.tsx` (440px brand panel with stepper/statement/identity variants, privacy note, wordmark) + `stepper.tsx`, `segmented.tsx`, `code-boxes.tsx` (paste + auto-advance + countdown hook)
- [ ] 2.2 Restyle screens 10–13 on the layout (segmented ownership/subsystem, Region select with 10 Cameroon regions, password meter, authorisation checkbox, split code boxes, details rows + copy, up-next steps)

## 3. Backend gaps

- [ ] 3.1 Staging validation: ownership/subsystem/region/town rules, authorisation `accepted`; SMS-instead endpoint (channel flip + reissue); change-email endpoint (unique check + payload patch + reissue)
- [ ] 3.2 Bootstrap: ready-details email, ready button targets school login URL, dynamic parent-domain prop to all auth pages (drop hardcoded suffix), remember-me passthrough, forgot-password placeholder page + route

## 4. Sign-in screens + verification

- [ ] 4.1 Restyle screens 14–16 (statement panel, school identity block with initials logo, show/hide password, error banner, staff note, top-bar links) + login rate limiting (attempts banner count, 15-min lockout per screen 16)
- [x] 4.2 Update Pest suite for new fields/endpoints (ownership, region/town, authorisation rejection, SMS-instead, change-email, ready email, remember) + `npm run build` + screenshot review vs Paper frames + pint + phpstan level 7 + full suite green
