## MODIFIED Requirements

### Requirement: School tenant root
The system SHALL provide a `schools` table as tenant root with UUIDv7 PK, unique name, globally unique workspace `slug` (used for subdomain resolution, reserved words blocked, immutable after creation), code, ownership in (government, mission, private), region + town, subsystem, cycle check, currency, timezone, nullable logo path, soft deletes.

#### Scenario: Create school
- **WHEN** a school is created with name, code, cycle in (primary, secondary, high_school)
- **THEN** a UUIDv7 row exists and all child rows reference it via school_id

#### Scenario: Duplicate slug
- **WHEN** a school is created with a slug already in use
- **THEN** the database rejects the write

#### Scenario: Slug update rejected
- **WHEN** any update attempts to change a school's slug
- **THEN** the write is rejected even if crafted by hand
