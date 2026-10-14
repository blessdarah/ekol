## ADDED Requirements

### Requirement: Fee plans price list

The system SHALL provide a `fee_plans` table scoped to school with level_id, academic_year text, UQ(school_id, level_id, academic_year), annual_amount numeric(10,2), currency char(3), is_active.

#### Scenario: Raise fees next year

- **WHEN** annual_amount increases for a new academic_year
- **THEN** a new plan row is added; old invoices keep old amounts

### Requirement: Invoices with copied amount

The system SHALL provide an `invoices` table with UQ(student_id, term_id), fee_plan_id, amount_due numeric(10,2) copied (not looked up), issued_on, status enum; balance SHALL always be amount_due minus SUM(payments).

#### Scenario: Ledger balance

- **WHEN** payments total less than amount_due
- **THEN** outstanding equals the difference with no stored balance column

### Requirement: Installment schedule

The system SHALL provide an `installments` table with invoice_id, seq, label, amount numeric(10,2), due_on, status; SUM(amount) over an invoice SHALL equal its amount_due (enforced transactionally).

#### Scenario: Split bill

- **WHEN** an invoice is split into three installments
- **THEN** the three amounts sum exactly to amount_due

### Requirement: Append-only cash-office payments

The system SHALL provide a `payments` table append-only with invoice_id, nullable installment_id (null = lump-sum top-up), amount, method enum (cash, bank_transfer, mobile_money, cheque), reference null, received_at, received_by; rows SHALL never be updated; no gateway columns.

#### Scenario: Record cash receipt

- **WHEN** cash is received in the office
- **THEN** an immutable payment row is appended with method cash
