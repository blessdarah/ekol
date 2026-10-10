## Context

Paper Screen 35 ("Student Roster") carries the complete sidebar: 10 links including Enrolment, which screen 01 predates. The codebase has auth screens, domain tables, and stub dashboard/setup pages, but no shared shell — each future flow would otherwise reinvent navigation. One other change is active (`auth-ui-paper-design`, in progress); this change touches only new shell files plus route groupings, so the two compose without file conflicts.

## Goals / Non-Goals

**Goals:**
- One persistent `AppLayout` used by all school pages; sidebar renders once per session conceptually.
- Screen-35-faithful sidebar on existing tokens (248px container, 34px rows, primary active states, badge slot).
- Ten stub destinations (9 sections + dashboard content stays stub) that later flows replace one by one.
- Shell data always live, never hardcoded.

**Non-Goals:**
- No real section content (dashboard stats, tables, drawers all stay stub).
- No school-switcher dropdown behavior (display + chevron only; switching schools is a later change).
- No role-based link visibility (all links visible to all roles for now).
- No mobile/responsive shell (1440px frames only, matching the auth approach).

## Decisions

- **Persistent layout via Inertia `layout` property over per-page shell markup.** Each page sets `Page.layout = (page) => <AppLayout>{page}</AppLayout>` (or a shared default in `app.tsx` for school pages). Rationale: sidebar state and scroll persist across visits; alternative (importing a sidebar component per page) remounts on every navigation.
- **Screen 35 over screen 01 as canonical.** Screen 01's 9-link nav predates the enrolment redesign; Screen 35 has the 10th link with full-row treatment. Alternative (screen 01 + conditional Enrolment) rejected per explicit user direction.
- **Shell data via shared Inertia props in `HandleInertiaRequests`.** School, current term (+ computed week), auth user, and overdue count shared once for all shell pages. Alternative (per-controller composition) rejected — it guarantees drift the moment a page forgets a prop.
- **Week math in PHP, not JS.** `(today - starts_on)/7 days + 1`, clamped to `week_count`; no current term → chip hidden (not zeroed). Keeps server/client consistent and testable.
- **Fees badge = overdue invoice count, live from day one.** The count query is trivial (`status=overdue` scope); hardcoding would bake in a lie next to live neighbors. If no fee data exists the badge shows nothing (not zero).
- **Stub pages name their flow explicitly** ("Students — arriving in the student flow") so placeholders are never mistaken for finished UI.

## Risks / Trade-offs

- [Risk] Shared props run on every shell request (extra queries) → Mitigation: three tiny indexed queries (school by id, current term, count); no N+1 by construction.
- [Risk] Later flows must adopt AppLayout or fork the shell → Mitigation: documented in tasks as the integration contract; stub replacement checklist included.
- [Risk] No-current-term edge leaves chip empty → Mitigation: specced as hidden chip; covered by a test.
- [Risk] Overlap with in-progress `auth-ui-paper-design` → Mitigation: disjoint file sets (layouts/app-layout vs layouts/auth-layout, new pages only); safe to interleave.

## Migration Plan

1. Layout + sidebar + stub pages + routes + shared props, behind existing `auth` + `ResolveSchool` (no migration changes at all).
2. Pest coverage (shell renders, active states, guards, live data, badge), `npm run build`, screenshot pass vs Screen 35, pint + phpstan-7 green.
3. Rollback: revert files (no schema touched).

## Open Questions

- School-switcher dropdown behavior — which change owns it? (Assumed later; display-only here.)
- Should stub pages be excluded from production builds/menus? (Assumed visible; they are the product map for now.)
