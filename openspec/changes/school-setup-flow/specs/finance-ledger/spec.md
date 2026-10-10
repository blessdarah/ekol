## MODIFIED Requirements

### Requirement: Installment schedule
The system SHALL provide an `installments` table with invoice_id, seq, label, amount numeric(10,2), due_on, status; rows are materialized from `fee_installment_templates` at invoice issue time as amount_due × percent; SUM(amount) over an invoice SHALL equal its amount_due (enforced transactionally).

#### Scenario: Split bill
- **WHEN** an invoice is split into three installments
- **THEN** the three amounts sum exactly to amount_due

#### Scenario: Template-driven issue
- **WHEN** an invoice is issued under a template
- **THEN** its installments mirror the template seq and proportions

### Requirement: Append-only cash-office payments
The system SHALL provide a `payments` table append-only with invoice_id, nullable installment_id (null = lump-sum top-up), amount, method enum (cash, bank_transfer, mobile_money, cheque), reference null, received_at, received_by; rows SHALL never be updated; no gateway columns. Partial payments SHALL fill the oldest unpaid installment first.

#### Scenario: Record cash receipt
- **WHEN** cash is received in the office
- **THEN** an immutable payment row is appended with method cash

#### Scenario: Oldest-first application
- **WHEN** a partial payment arrives against several unpaid installments
- **THEN** it applies to the oldest unpaid installment first
