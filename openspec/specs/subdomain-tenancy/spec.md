## ADDED Requirements

### Requirement: Subdomain school resolution

The system SHALL resolve the current school from the request subdomain via `schools.slug` on every school-address request, making the school available to routing, controllers, and views for that request.

#### Scenario: Unknown subdomain

- **WHEN** a request arrives on an unregistered subdomain
- **THEN** the system responds with a not-found page, not another school's data

### Requirement: Session school scope

The system SHALL limit an authenticated session to the resolved school's data; cross-school access through URL manipulation SHALL be rejected.

#### Scenario: Cross-school URL tampering

- **WHEN** a user of school A requests school B's resource URL under A's session
- **THEN** access is denied

### Requirement: Find-school vs own-address behavior

The system SHALL show a find-school (workspace address) step only on the general sign-in page, skipping it when the user opens their school's own address.

#### Scenario: Own address skips lookup

- **WHEN** a user opens their school's address directly
- **THEN** they land on the branded sign-in with no workspace lookup step

#### Scenario: General page requires lookup

- **WHEN** a user opens the general sign-in page
- **THEN** they must enter their workspace address first
