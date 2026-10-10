## ADDED Requirements

### Requirement: Levels ladder
The system SHALL provide a `levels` table scoped to school with name UQ per school, ordinal, cycle, subsystem null, uses_series bool, soft deletes.

#### Scenario: Ordered ladder
- **WHEN** levels are listed ordered by ordinal
- **THEN** progression matches the configured ladder

### Requirement: School classes
The system SHALL provide a `school_classes` table (named to avoid `class` reserved word) with school_id, level_id, name UQ per (level_id, name), nullable form_master_id to users, capacity, stream null, soft deletes; class delete SHALL be RESTRICT when students exist.

#### Scenario: Assign form master later
- **WHEN** a class is created without form_master_id then assigned
- **THEN** remarks and attendance resolve to the assigned user

### Requirement: Series and per-term junction
The system SHALL provide `series` scoped to school+level with UQ(level_id, name), code, is_open, and `student_series` junction (student_id, series_id, term_id) with UQ(student_id, term_id) enforcing one series per student per term, plus chosen_by and chosen_at.

#### Scenario: Re-choose next term
- **WHEN** a student picks Science in T1 then Arts in T2
- **THEN** two junction rows exist keyed by term
