## ADDED Requirements

### Requirement: Assessment state machine
The system SHALL provide an `assessments` table scoped to school with term_id, school_class_id, kind, name, state enum (draft, scheduled, marks_open, marks_closed, published), weights, scheduled_for, total_max; state SHALL advance draft→scheduled→marks_open→marks_closed→published.

#### Scenario: Tab bar reflects state
- **WHEN** an assessment is in marks_open
- **THEN** subject teachers may enter and revise marks

### Requirement: Assessment fan-out
The system SHALL provide `assessment_subjects` with UQ(assessment_id, subject_id), frozen coefficient_id snapshot, max_score, examiner_id, venue.

#### Scenario: Frozen weight
- **WHEN** a coefficient changes after scheduling
- **THEN** existing assessment_subject rows keep the original coefficient_id

### Requirement: Marks with absence rule
The system SHALL provide a `marks` table with UQ(assessment_subject_id, student_id), score numeric(5,1), nullable grade_band_id, is_absent bool, remark, entered_by, entered_at; check SHALL enforce score between 0 and max_score OR is_absent true.

#### Scenario: Absent without score
- **WHEN** is_absent is true
- **THEN** a null/zero score is accepted and graded as absent

### Requirement: Tenant-scoped grade bands
The system SHALL provide `grade_bands` scoped to school (divergence from ERD global) with UQ(school_id, letter), from/to percent, meaning, standard_remark, rank_order; band resolution at entry SHALL be stored on mark so later band edits never re-grade history.

#### Scenario: Band edit is not retroactive
- **WHEN** a band threshold changes after marks are entered
- **THEN** existing marks keep their stored grade_band_id

### Requirement: Immutable reports
The system SHALL provide a `reports` table with UQ(student_id, term_id), class_position null, total_score, head_teacher_remark, next_term_opens_on null, published_at, voided_at null; rows SHALL never be updated or deleted — corrections void and reissue.

#### Scenario: Correct published card
- **WHEN** a published report needs fixing
- **THEN** the row is voided (voided_at set) and a new row is issued
