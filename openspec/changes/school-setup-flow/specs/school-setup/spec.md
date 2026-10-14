## ADDED Requirements

### Requirement: Setup page zones with autosave

The system SHALL render School Setup with six independently autosaved zones (profile, academic year & terms, fee installments, sequences & exams windows, school day); each zone debounces input, validates inline, and persists without a submit cycle.

#### Scenario: Autosave profile

- **WHEN** the admin edits the school name and pauses
- **THEN** the name persists and a saved indicator confirms it

### Requirement: Logo upload

The system SHALL accept a school logo (PNG or SVG, square, at least 256px, server-validated) stored per school and consumed by the login identity block, report cards, and receipts.

#### Scenario: Invalid logo rejected

- **WHEN** a non-square or undersized file is uploaded
- **THEN** the upload is rejected with a dimensions error and the old logo stays

### Requirement: Installment templates

The system SHALL provide `fee_installment_templates` (school + year + seq + percent) whose percents sum to 100; the count stepper and splits UI edit the template, and issuing an invoice materializes per-invoice installments as amount_due × percent.

#### Scenario: Template materialization

- **WHEN** an invoice is issued under a 45/33/22 template
- **THEN** three installment rows are created in those proportions summing to amount_due

### Requirement: Assessment windows

The system SHALL store window start/end dates per assessment, editable from Setup while no marks exist; teachers may enter marks only inside an open window.

#### Scenario: Closed window blocks entry

- **WHEN** marks are submitted outside the assessment window
- **THEN** the submission is rejected

### Requirement: School-day config

The system SHALL store the school's school days (weekday pills) and periods (label, starts/ends, break flag) editable from Setup, with slot counts derived (never stored).

#### Scenario: Add a break

- **WHEN** a break row is added between periods
- **THEN** timetable generation sees it without any stored slot total changing

### Requirement: Edit guards

The system SHALL exclude `slug` from every update path (model guard backstop included) and reject date/sequence edits on terms that have any marks, rendering those controls disabled with a reason in Setup.

#### Scenario: Locked term edit rejected

- **WHEN** a term with marks is edited
- **THEN** the write is rejected even if crafted by hand
