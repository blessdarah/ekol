## ADDED Requirements

### Requirement: Persistent admin layout
The system SHALL render authenticated school pages inside a persistent Inertia layout: 248px sidebar plus 1192px main column, so navigating between sections never re-renders the sidebar.

#### Scenario: Sidebar persists across navigation
- **WHEN** a user moves from Dashboard to Fees
- **THEN** only the main column content changes

### Requirement: Canonical sidebar per Screen 35
The system SHALL render the sidebar exactly per Screen 35: school switcher (logo initials, school name, role, chevron), active-term chip, Academics section (Dashboard, Students, Enrolment, Classes & Subjects, Series Registration, Sequences & Exams, Timetable), Administration section (Fees with count badge, Teachers & Staff, School Setup), and user chip (initials avatar, full name, role). Rows are 34px with icons.

#### Scenario: Full link inventory
- **WHEN** the sidebar renders
- **THEN** all 10 links appear in Screen 35 order, including Enrolment between Students and Classes & Subjects

#### Scenario: Active link follows route
- **WHEN** the user is on the Students stub
- **THEN** only the Students row shows the active state

### Requirement: Live shell data
The system SHALL feed the shell with live data: current school and role in the switcher, current term label with computed week position ("Week 5 of 15" from today against term dates), authenticated user's chip, and the overdue-invoice count on the Fees badge.

#### Scenario: Term week math
- **WHEN** today falls in week 5 of a 15-week current term
- **THEN** the chip reads "Week 5 of 15"

### Requirement: Stub routes behind guards
The system SHALL expose one route per nav section behind `auth` + subdomain tenancy, each rendering a clearly-marked stub page naming its future flow, so later changes replace exactly one page without touching the sidebar.

#### Scenario: Dummy link lands on stub
- **WHEN** a user opens any unbuilt section link
- **THEN** a stub page names that section as forthcoming

#### Scenario: Guests are kept out
- **WHEN** an unauthenticated visitor opens any shell route
- **THEN** they are redirected to sign-in
