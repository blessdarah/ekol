## MODIFIED Requirements

### Requirement: School tenant root
The system SHALL provide a `schools` table as tenant root with UUIDv7 PK, unique name, globally unique workspace `slug` (used for subdomain resolution, reserved words blocked), code, nullable location (screen 10), cycle check, currency, timezone, soft deletes.

#### Scenario: Create school
- **WHEN** a school is created with name, code, cycle in (primary, secondary, high_school)
- **THEN** a UUIDv7 row exists and all child rows reference it via school_id

#### Scenario: Duplicate slug
- **WHEN** a school is created with a slug already in use
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
