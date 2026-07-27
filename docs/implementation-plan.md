# Phased implementation plan

## Phase 1 - Read-only CEO/accountant work desk
- Create the owner command screen, agent profiles, work queue, approval queue, and audit view.
- Route business goals to the AI CEO and finance tasks to the AI Accountant.
- Keep sensitive actions in draft form only.

## Phase 2 - Persist objectives and delegated work
- Store business objectives, agent work items, approvals, and audit events.
- Add status changes for queued, in-progress, waiting-for-approval, completed, and rejected work.
- Add owner-controlled autonomy settings per agent.

## Phase 3 - Accounting data connectors
- Connect read-only accounting data, invoice data, receivables, payables, expenses, and bank summaries.
- Add reconciliation exception reports and variance notes.
- Keep payments, journal entries, reimbursements, and external report release approval-gated.

## Phase 4 - Monthly invoice email automation
- Create owner-approved recurring invoice rules with billing day, send time, due date, customer scope, and Gmail template.
- Generate monthly invoice PDFs and Gmail messages from approved customer and billing records.
- Auto-send routine invoices immediately when enabled; send exceptions to approval.

## Phase 5 - Collections and customer communication
- Generate overdue aging lists, reminders, and collections forecasts.
- Queue collection emails or SMS drafts for owner or billing lead approval.
- Escalate disputed, strategic, or high-impact accounts to a human.

## Phase 6 - Email, calendar, and operating tasks
- Draft replies, schedule appointments, create reminders, and prepare meeting summaries.
- Connect approved decisions to task owners and due dates.
- Record all external drafts and releases in audit logs.

## Phase 7 - Supervised execution
- Allow recurring low-risk routines to run only after policy approval.
- Keep exceptions, money movement, accounting postings, and legal/customer-impact actions held for approval.
- Add emergency stop, rollback notes, and daily owner summaries.
