## ADDED Requirements

### Requirement: Timetable slots as weekly rules

The system SHALL provide a `timetable_slots` table scoped to school with term_id, school_class_id, period_id, nullable subject_id/staff_id/room_id, weekday smallint, UQ(term_id, school_class_id, period_id, weekday); one row SHALL represent one recurring weekly lesson.

#### Scenario: Conflict prevented

- **WHEN** two slots share term+class+period+weekday
- **THEN** the second insert is rejected

### Requirement: Tenant-scoped periods

The system SHALL provide a `periods` table scoped to school (divergence from ERD global) with label, ordinal, starts_at/ends_at time, is_break, soft deletes; UQ(school_id, ordinal).

#### Scenario: Bell schedule per school

- **WHEN** two schools define different period 1 times
- **THEN** each keeps its own rows

### Requirement: Rooms

The system SHALL provide a `rooms` table scoped to school with code UQ per school, name, capacity, kind enum, soft deletes.

#### Scenario: Capacity check

- **WHEN** a class is assigned a room smaller than class capacity
- **THEN** validation rejects the assignment

### Requirement: Attendance register

The system SHALL provide an `attendance` table with timetable_slot_id, student_id, date, status enum (present, absent, late, excused), marked_by, marked_at; UQ(timetable_slot_id, date, student_id).

#### Scenario: Daily register

- **WHEN** attendance is taken for a slot on a date
- **THEN** one row per student exists for that date

### Requirement: Teaching logs

The system SHALL provide a `teaching_logs` table with timetable_slot_id, staff_id, date, topic text, nullable started_at/ended_at, notes; topic SHALL drive coverage reports.

#### Scenario: Coverage report source

- **WHEN** logs are recorded with topics across dates
- **THEN** syllabus progress can be derived from topics

### Requirement: Polymorphic audit trail

The system SHALL provide an `audit_events` table scoped to school with nullable actor_id to users (SET NULL on delete), entity text, entity_id uuid, action text, diff jsonb, occurred_at; rows SHALL never be updated or deleted and SHALL be written in the same transaction as the change.

#### Scenario: History survives staff deletion

- **WHEN** a staff user is soft-deleted
- **THEN** their audit rows remain with actor_id null
