## ADDED Requirements

### Requirement: Subjects
The system SHALL provide a `subjects` table scoped to school with code UQ, name, department, weekly_periods, is_theory_practical, soft deletes.

#### Scenario: Subject without weight
- **WHEN** a subject is created with no coefficient rows
- **THEN** it is treated as not offered at any level (blank matrix cell)

### Requirement: Coefficient matrix cells
The system SHALL provide a `coefficients` table as subject×level intersection with UQ(subject_id, level_id), sequence_coeff and exam_coeff numeric(3,1), nullable current_version_id pointer, status enum (draft, pending, complete), last_reviewed_at.

#### Scenario: Missing cell means not offered
- **WHEN** no coefficient row exists for subject×level
- **THEN** assessments and reports exclude that combination

### Requirement: Append-only coefficient versions
The system SHALL provide `coefficient_versions` append-only with coefficient_id, version, coeffs, effective_term_id, changed_by, changed_at, reason; UQ(coefficient_id, version); rows SHALL never be updated or deleted.

#### Scenario: Weight change takes effect forward
- **WHEN** Maths Form 4 changes 1.0 to 1.5 from Term 1 2026/27
- **THEN** a v2 row is appended and prior reports keep v1 weights

### Requirement: Subject teachers
The system SHALL provide `subject_teachers` junction (subject_id, staff users.id) with role enum (lead, backup), assigned_at, released_at null, and partial unique at most one lead per subject.

#### Scenario: Lead plus backup
- **WHEN** two teachers are assigned with roles lead and backup
- **THEN** both rows coexist; a second lead is rejected
