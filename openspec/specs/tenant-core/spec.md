## ADDED Requirements

### Requirement: School tenant root
The system SHALL provide a `schools` table as tenant root with UUIDv7 PK, unique name, globally unique workspace `slug` (used for subdomain resolution, reserved words blocked), code, nullable location (screen 10), cycle check, currency, timezone, soft deletes.

#### Scenario: Create school
- **WHEN** a school is created with name, code, cycle in (primary, secondary, high_school)
- **THEN** a UUIDv7 row exists and all child rows reference it via school_id

#### Scenario: Duplicate slug
- **WHEN** a school is created with a slug already in use
- **THEN** the database rejects the write

### Requirement: Academic year table
The system SHALL provide an `academic_years` table scoped to school with UQ(school_id, label), starts_on/ends_on dates, status in (planned, current, closed), created_at only; exactly one current year per school enforced by partial unique index on (school_id) where status = current. It SHALL be the parent of terms, fee plans, school classes and enrolments.

#### Scenario: Single current year
- **WHEN** a second year is set to current for the same school
- **THEN** the database rejects the write

#### Scenario: Closing a year locks its terms
- **WHEN** an academic year is closed
- **THEN** its terms are no longer editable (enforced at app level)

### Requirement: Term time anchor
The system SHALL provide a `terms` table scoped to school with academic_year_id FK, bare label ("Term 1", year from its academic year), sequence UQ per (academic_year_id, sequence), dates that fall inside its year (enforced at app level — cross-table rules cannot be declarative CHECKs), week_count, is_current, with exactly one current term per school enforced by partial unique index.

#### Scenario: Single current term
- **WHEN** a second term is marked is_current for the same school
- **THEN** the database rejects the write

#### Scenario: Term sequence scoped to year
- **WHEN** two terms share a sequence within the same academic year
- **THEN** the database rejects the write

### Requirement: Unified users auth with role
The system SHALL provide a `users` table (Option A merge of ERD staff) with school_id, staff_code unique per school, full_name, initials, email unique, role enum (principal, academic_lead, teacher, form_master, admin, accountant), phone unique per school, is_form_master, invited_at, password hashed, soft deletes.

#### Scenario: Staff login identity
- **WHEN** a user signs in with email and password
- **THEN** role and school_id resolve tenant and permissions boundary

#### Scenario: Duplicate phone within a school
- **WHEN** a user is created with a phone already used in the same school
- **THEN** the database rejects the write

#### Scenario: Same phone across schools
- **WHEN** users in two different schools share a phone number
- **THEN** both rows coexist

### Requirement: Student records without login
The system SHALL provide a `students` table scoped to school with NO class column (a student's class for a year lives on `enrolments`), admission_no unique per school, full_name, gender, dob, guardian text fields, admitted_on, soft deletes; students SHALL NOT have credentials. One student row covers the student's whole life at the school.

#### Scenario: Enrol student
- **WHEN** a student is admitted with an admission_no
- **THEN** a student row plus a first-year enrolment row exist, and marks, invoices, attendance and reports can reference the student row
