# Payment System Overhaul — Progress Tracker

## Phase 0: Audit ✅
- Reviewed all DB tables: bank_transfers, pending_payments, payment_references, payment_details
- Reviewed CreditCardInput.tsx, payment.service.ts, checks/actions.ts (~3000 lines)
- Reviewed emission wizards: emitir/ (CC), emitir-v2/ (CC v2), emitir-danos-terceros/ (DT)
- Reviewed BankHistoryTab, PendingPaymentsTab, RegisterPaymentWizard
- Identified 10 gaps (see memory)

## Phase 1: Card Security Hardening — IN PROGRESS
- [ ] CreditCardInput.tsx: CVV type=password, cleanup on unmount, no logging
- [ ] Payment adapter abstraction layer
- [ ] Technical comments for future PagueloFacil integration

## Phase 2: Payment Adapter Service — PENDING
## Phase 3: DB Schema Enhancements — PENDING
## Phase 4: Emission → Payment Obligation Generation — PENDING
## Phase 5: Bank History Enhancements — PENDING
## Phase 6: Pending Payments Enhancements — PENDING
## Phase 7: Manual Wizard Fallback — PENDING
## Phase 8: Recurring Payments Automation — PENDING
## Phase 9: Insurer Payment Export — PENDING
## Phase 10: UX States — PENDING
## Phase 11: E2E Smoke Tests — PENDING
## Phase 12: TypeScript Check — PENDING
