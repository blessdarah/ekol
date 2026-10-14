## ADDED Requirements

### Requirement: School tenant root

The system SHALL provide a `schools` table as tenant root with UUIDv7 PK, unique name, code, cycle check, currency, timezone, soft deletes.

#### Scenario: Create school

- **WHEN** a school is created with name, code, cycle in (primary, secondary, high_school)
- **THEN** a UUIDv7 row exists and all child rows reference it via school_id

### Requirement: Term time anchor

The system SHALL provide a `terms` table scoped to school with label, sequence, dates, week_count, is_current, with exactly one current term per school enforced by partial unique index.

#### Scenario: Single current term

- **WHEN** a second term is marked is_current for the same school
- **THEN** the database rejects the write

### Requirement: Unified users auth with role

The system SHALL provide a `users` table (Option A merge of ERD staff) with school_id, staff_code unique per school, full_name, initials, email unique, role enum (principal, academic_lead, teacher, form_master, admin, accountant), phone, is_form_master, invited_at, password hashed, soft deletes.

#### Scenario: Staff login identity

- **WHEN** a user signs in with email and password
- **THEN** role and school_id resolve tenant and permissions boundary

### Requirement: Student records without login

The system SHALL provide a `students` table scoped to school with class_id NOT NULL, admission_no unique, full_name, gender, dob, guardian text fields, admitted_on, soft deletes; students SHALL NOT have credentials.

#### Scenario: Enrol student

- **WHEN** a student is admitted with class_id and admission_no
- **THEN** marks, invoices, attendance and reports can reference the row
