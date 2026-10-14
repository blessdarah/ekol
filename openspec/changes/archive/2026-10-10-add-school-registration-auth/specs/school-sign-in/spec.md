## ADDED Requirements

### Requirement: Branded school sign-in

The system SHALL render the sign-in form with the resolved school's logo and name (from School Setup), accepting email or phone plus password.

#### Scenario: Phone login

- **WHEN** a user signs in with a phone number and correct password
- **THEN** authentication succeeds exactly as with email

### Requirement: First-visit setup routing

The system SHALL route an administrator's first visit after registration to School Setup instead of the dashboard.

#### Scenario: Fresh workspace entry

- **WHEN** the founding administrator signs in for the first time
- **THEN** they land on School Setup, not the admin dashboard

### Requirement: Sign-in error handling

The system SHALL show a dedicated sign-in error state (screen 16) for failed credentials without revealing whether the email/phone or the password was wrong.

#### Scenario: Wrong password

- **WHEN** credentials do not match
- **THEN** a generic error state is shown with no account-enumeration detail
