## Why

Every future flow (Students, Fees, Timetable…) needs the same admin shell, and Paper defines it once: Screen 35's sidebar is the canonical, complete version (10 links including Enrolment — screen 01's 9-link variant predates the enrolment redesign). Building one persistent skeleton now means later flows replace exactly one stub page each without touching navigation.

## What Changes

- Persistent Inertia `AppLayout` (sidebar + slot): 248px sidebar with school switcher, active-term chip, 10-link nav in Academics/Administration sections with Fees badge slot, and user chip; 1192px main column.
- Screen-35-canonical nav: Dashboard, Students, Enrolment, Classes & Subjects, Series Registration, Sequences & Exams, Timetable, Fees (badge), Teachers & Staff, School Setup — every link real in the sidebar, each landing on a clearly-marked stub page until its flow is built.
- Live shell data: current school + role (switcher), current term with week math ("Week 5 of 15"), auth user chip, overdue-invoice count for the Fees badge.
- All shell routes behind `auth` + `ResolveSchool`; active-link highlighting follows the current route.

## Capabilities

### New Capabilities
- `admin-shell`: persistent admin layout, canonical sidebar, stub routes, live shell data, guards.

### Modified Capabilities
- None (dashboard/setup stubs gain shell + stub body, but no spec has ever covered their content).

## Impact

- Affected: new `resources/js/layouts/app-layout.tsx` + sidebar component, new stub pages per section, `routes/web.php` (shell group), a small shell-data provider (shared Inertia props or per-controller composition).
- Untouched: auth screens 10–16, all domain tables/models, existing tests (suite extended, not rewritten).
- Later flows replace one stub page each; sidebar file stays closed.
