# AI Accountant + CEO Workbench

## 1. Executive summary
This implementation provides a secure blueprint for a two-agent business assistant. The AI CEO converts owner goals into priorities, decisions, and delegated work. The AI Accountant prepares finance analysis, reports, reconciliations, and approval-ready actions. Sensitive actions stay behind human approval, role-based controls, and audit logs.

## 2. System architecture
- Frontend: React + JavaScript + Vite
- API layer: PHP routes for orchestrator, approvals, and future integrations
- Data layer: MariaDB with schema for companies, departments, users, agents, business objectives, agent work items, approvals, audit logs, conversations, messages, and tasks
- Integrations: accounting system, bank feeds, Gmail, calendar, CRM, and existing business APIs
- Security: RBAC, department-level permissions, company-level isolation, logged approvals, and emergency stop

## 3. Agent responsibilities
- AI CEO: prioritize objectives, delegate work, draft decisions, run approved monthly invoice policy, assign owners, escalate blockers, and summarize executive risk
- AI Accountant: review invoices, generate monthly invoice packets, prepare Gmail-ready invoice emails, review payments, expenses, receivables, collections, budgets, close tasks, and management reports; prepare drafts only
- Owner: approve sensitive actions, change autonomy level, release external messages, post accounting changes, and stop automation

## 4. Security and governance
- Read-only analysis is allowed automatically
- Sensitive actions require human approval
- No AI deletion of company records, no password exposure, no bypass of permissions, no hidden money movement, no unsupported financial claims
- Monthly invoice auto-send sends routine invoices immediately when enabled; exceptions must be drafted or approval-gated
- Audit log captures actor, action, entity, old/new values, timestamp, and approval state
- Emergency stop disables automation and external actions

## 5. Phased implementation plan
1. Read-only CEO/accountant work desk
2. Business objective and work-item persistence
3. Accounting system and bank-feed read connectors
4. Approval queues for invoice exceptions, collections, payments, journal entries, and external reports
5. Email/calendar drafting with owner release
6. Supervised execution for approved recurring routines

## 6. API routes
- POST /api/routes/orchestrator.php
- POST /api/routes/approvals.php
- POST /api/routes/monthly-invoices.php
- GET /api/routes/dashboard.php
- GET /api/routes/accountant.php
- GET/PUT /api/routes/profile.php
- GET/PUT /api/routes/settings.php

## 7. Database tables
- companies
- departments
- users
- agent_profiles
- automation_rules
- business_objectives
- agent_work_items
- invoice_email_rules
- invoice_email_runs
- invoice_email_messages
- approvals
- audit_logs
- conversations
- messages
- tasks

Controller data access uses parameterized PHP queries. Database setup and migration scripts live in `database/sql`, outside the public build.

## 8. Sample prompts
- Check the business today and tell me what needs attention.
- Prepare a cash flow review and tell me which payments need approval.
- Generate monthly invoices and send approved customer invoices by Gmail.
- Build an overdue collection list and draft customer-safe reminders.
- Prepare month-end close exceptions and draft journal entries for review.

## 9. Sample responses
- CEO directive with priorities, owners, and blockers.
- Accountant packet with cash, receivables, payables, and exception notes.
- Gmail invoice batch with PDF attachments for routine approved invoices and drafts for exceptions.
- Approval-required queue for payments, journal entries, reimbursements, and external messages.

## 10. Testing strategy
- Unit tests for route handlers and schema validation
- Integration tests for orchestrator and approval flow
- Manual acceptance tests for each agent role

## 11. Deployment and backup
- Deploy frontend to a web server and API behind HTTPS
- Use MariaDB backups and daily export of audit logs
- Enable monitoring, alerting, and rollback plans
