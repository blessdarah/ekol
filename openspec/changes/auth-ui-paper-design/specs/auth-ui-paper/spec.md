## ADDED Requirements

### Requirement: Shared auth layout
The system SHALL render auth screens 10–16 on a shared layout: 440px brand panel (Campus wordmark, per-screen middle content, "Private by default" privacy note) beside a 592px form column, using the file's design tokens (deep-green primary, primary-tint selected states, Inter Tight display + Inter body).

#### Scenario: Consistent shell
- **WHEN** any auth screen 10–16 renders
- **THEN** the brand panel, wordmark, privacy note, and form column share one layout with per-screen middle content only

### Requirement: Screen 10 school details
The system SHALL render screen 10 with a 3-step stepper (step 1 active), school name, short name + workspace address with parent-domain suffix and live availability caption, ownership segmented selector (Government/Mission/Private), Region select + Town, subsystem segmented selector (Anglophone (GCE)/Francophone/Bilingual), Continue action, and the School Setup change-later note.

#### Scenario: Ownership selection
- **WHEN** a registrar picks Mission
- **THEN** the segmented control shows Mission selected and submits that value

### Requirement: Screen 11 administrator
The system SHALL render screen 11 with stepper step 2 active, dynamic "You will manage {school}" subheading, Name + Role, Email + Phone, Password with strength meter, required authorisation checkbox, Send-code + Back actions.

#### Scenario: Missing authorisation
- **WHEN** the form is submitted without the authorisation checkbox
- **THEN** submission is rejected with an authorisation error

### Requirement: Screen 12 verification
The system SHALL render screen 12 with stepper step 3 active, the masked destination email, six split code boxes, resend countdown, Send-by-SMS-instead and Change-email actions, Verify action with 10-minute expiry note, and spam-folder help.

#### Scenario: Countdown display
- **WHEN** the verify page renders with unexpired time remaining
- **THEN** it shows the live resend countdown from the expiry prop

### Requirement: Screen 13 workspace ready
The system SHALL render screen 13 with a Workspace-created badge, "{school} is ready" heading, address/administrator/student-ID-format rows with a copy action, Up-next 01/02/03 steps, and a Continue-to-sign-in action targeting the school login URL.

#### Scenario: Copy address
- **WHEN** the copy action is used on the workspace address
- **THEN** the full school address lands on the clipboard

### Requirement: Screen 14 find school
The system SHALL render screen 14 with the marketing statement panel, "New to Campus? Register" top bar, Find-your-school form with a single address field, Continue action, and welcome-email help note.

#### Scenario: Help text
- **WHEN** the find-school page renders
- **THEN** it shows where to find a forgotten workspace address

### Requirement: Screens 15 and 16 sign in
The system SHALL render screen 15 with the school identity block (logo initials, name, mono address), "Not your school? Switch school" top bar, Email-or-phone + Password with show toggle, remember checkbox, forgot-password placeholder, staff invite note; screen 16 SHALL be identical plus an error banner that reveals nothing account-enumerating.

#### Scenario: Error state
- **WHEN** sign-in fails
- **THEN** screen 16 renders with a generic banner and no indication of which field was wrong
