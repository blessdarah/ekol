## MODIFIED Requirements

### Requirement: Fee plans price list

The system SHALL provide a `fee_plans` table scoped to school with level_id, academic_year_id FK (replacing free text), UQ(school_id, level_id, academic_year_id), annual_amount numeric(10,2), currency char(3), is_active.

#### Scenario: Raise fees next year

- **WHEN** annual_amount increases for a new academic year
- **THEN** a new plan row is added pointing at the new year; old invoices keep old amounts
