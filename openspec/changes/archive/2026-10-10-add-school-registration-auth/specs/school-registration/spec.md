## ADDED Requirements

### Requirement: Staged school capture with live slug check
The system SHALL provide a registration flow capturing school details (name, short name, workspace slug, type, location, subsystem) with a live availability check on the slug, staging the payload without persisting any domain rows until verification completes.

#### Scenario: Slug taken
- **WHEN** a registrar types a workspace slug already in use
- **THEN** the form reports it as unavailable before submission

### Requirement: Administrator account staging
The system SHALL capture the first administrator (name, role, email, phone, password hashed, authorisation) alongside the school payload, rejecting emails that already belong to an administrator.

#### Scenario: Duplicate admin email
- **WHEN** the admin email matches an existing user
- **THEN** registration is rejected with an email-already-registered error

### Requirement: Six-digit verification with resend and fallback
The system SHALL verify the admin email with a six-digit code expiring in 10 minutes, with limited attempts before a resend is required, and SMS fallback when email delivery fails. Attempts and expiries SHALL be recorded on an auditable row (not session-only).

#### Scenario: Expired code
- **WHEN** a code older than 10 minutes is submitted
- **THEN** it is rejected and a resend is offered

#### Scenario: Too many attempts
- **WHEN** attempts exceed the limit
- **THEN** further tries are blocked until a fresh code is issued

### Requirement: Verified bootstrap transaction
The system SHALL, on successful verification only, create the school, its administrator user, the academic year and its terms in a single transaction, then present the workspace-ready screen (address, administrator, student ID format).

#### Scenario: Nothing before verify
- **WHEN** verification has not completed
- **THEN** no school, user, year, or term rows exist for the registration

#### Scenario: Atomic bootstrap
- **WHEN** any part of the bootstrap write fails
- **THEN** no partial rows remain
