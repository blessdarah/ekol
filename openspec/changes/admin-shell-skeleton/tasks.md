## 1. Layout + sidebar

- [x] 1.1 Create `resources/js/layouts/app-layout.tsx` (248px sidebar: switcher, term chip, 10-link nav with badge slot, user chip; 1192px main slot) + `components/shell/sidebar.tsx` using Paper tokens and exact Screen 35 structure
- [x] 1.2 Wire persistent layout (page `layout` property or shared default for school pages) so the sidebar survives navigation

## 2. Routes + stubs + shell data

- [x] 2.1 Add shell route group (`auth` + `ResolveSchool`): dashboard + 9 section stubs, each rendering a named forthcoming-flow page
- [x] 2.2 Share shell props in `HandleInertiaRequests` (current school + role, current term with computed week, auth user chip, overdue-invoice count); hide term chip when no current term

## 3. Verification

- [x] 3.1 Pest coverage (shell renders on every stub, active-link per route, guest redirect, live school/term/user data, badge count, hidden chip without current term) + `npm run build` + screenshot pass vs Screen 35 + pint + phpstan level 7 + full suite green
