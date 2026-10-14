## ADDED Requirements

### Requirement: Levels ladder

The system SHALL provide a `levels` table scoped to school with name UQ per school, ordinal, cycle, subsystem null, uses_series bool, soft deletes.

#### Scenario: Ordered ladder

- **WHEN** levels are listed ordered by ordinal
- **THEN** progression matches the configured ladder

### Requirement: School classes

The system SHALL provide a `school_classes` table (named to avoid `class` reserved word) with school_id, academic_year_id FK (next year's classes are new rows), level_id, name UQ per (academic_year_id, level_id, name), nullable form_master_id to users, capacity, stream null, soft deletes; class delete SHALL be RESTRICT when enrolments exist.

#### Scenario: Assign form master later

- **WHEN** a class is created without form_master_id then assigned
- **THEN** remarks and attendance resolve to the assigned user

#### Scenario: New year new classes

- **WHEN** a new academic year starts
- **THEN** fresh class rows are created for that year; prior-year enrolments keep pointing at the old rows

### Requirement: Enrolment per year

The system SHALL provide an `enrolments` table with student_id, academic_year_id, nullable school_class_id (null until the student is placed), UQ(student_id, academic_year_id), status in (admitted, placed, enrolled, left), nullable decision in (promote, repeat, leaving) set in re-enrolment. Class delete SHALL be RESTRICT while enrolments point at it. Screen lifecycle: Admitted creates the row, Class placement sets school_class_id, Re-enrolment sets decision, Confirm enrolment moves every placed row to enrolled.

#### Scenario: Admit then place

- **WHEN** a student is admitted for a year then placed in a class
- **THEN** the row moves from admitted with null class to placed with a class

#### Scenario: One row per student per year

- **WHEN** a second enrolment is created for the same student and year
- **THEN** the database rejects the write

### Requirement: Series and per-term junction

The system SHALL provide `series` scoped to school+level with UQ(level_id, name), code, is_open, and `student_series` junction (student_id, series_id, term_id) with UQ(student_id, term_id) enforcing one series per student per term, plus chosen_by and chosen_at.

#### Scenario: Re-choose next term

- **WHEN** a student picks Science in T1 then Arts in T2
- **THEN** two junction rows exist keyed by term
