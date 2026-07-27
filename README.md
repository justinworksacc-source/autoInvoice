# AI Accountant + CEO Workbench

This workspace contains a secure starter implementation for a two-agent business assistant: an AI CEO that prioritizes and delegates work, and an AI Accountant that prepares finance packets, reports, reconciliation items, and approval-ready actions.

## Included
- React + JavaScript frontend with a business work desk
- CEO/accountant delegation flow with approval gates
- Monthly invoice email automation screen for Gmail delivery rules
- Vercel JavaScript API functions for authentication, customers, invoices, business dates, and Xendit
- MariaDB schema for objectives, work items, governance, audit, and agent configuration
- Architecture and implementation notes

## Quick start
1. Install dependencies: npm install
2. Start the frontend: npm run dev
3. Use `vercel dev` when testing the frontend and API functions together

## Vercel frontend deployment

- The included `vercel.json` builds the Vite frontend into `dist` and supports client-side routes without Vercel 404 pages.
- In Vercel, keep the project Root Directory at the repository root. The build command and output directory come from `vercel.json`.
- Vercel hosts both the frontend and the JavaScript functions under `api/*.js`. Configure the required environment variables and a managed MySQL-compatible database before using login, Gmail, or Xendit.

## Vercel production environment

Add `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `SESSION_SECRET`, and `APP_PUBLIC_URL` in Vercel Project Settings. Use a managed MySQL-compatible database reachable over the internet; `127.0.0.1` only works locally. Import `database/sql/schema.sql` into that database. Add the Xendit and invoice sender variables from `.env.example` only when those integrations are enabled.

## MariaDB customer data
- The Customers page reads and writes customers and payments through `GET/POST /api/monthly-invoices`.
- Vercel functions store data in the managed MySQL database configured through environment variables.
- Create the local database and app user with `sudo mariadb < database/sql/local-setup.sql` and import the schema with `sudo mariadb < database/sql/schema.sql`.
- The first successful DB connection copies existing browser customer/payment records into MariaDB when the DB is empty.
- Inspect local data with `mariadb -u ai_agent -pai_agent_local systemt_ai -e "SELECT * FROM monthly_invoice_clients; SELECT * FROM monthly_invoice_payments;"`.

## Xendit payments

- The customer details panel opens Xendit's hosted checkout for the outstanding balance.
- Set `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN`, and `APP_PUBLIC_URL` in `.env`.
- Import `database/sql/schema.sql`, then register `https://YOUR_HOST/api/xendit?webhook=1` as the Payment Session webhook in the Xendit Dashboard.
- Successful Xendit webhooks are recorded once in the customer payment ledger. Never place the Xendit secret key in browser JavaScript.

## Gmail invoice sending
- The Customers page `Send now` button calls `POST /api/send-invoice`.
- The JavaScript function forwards the invoice payload to the configured secure delivery webhook.
- Configure `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN`; set `GMAIL_ACCESS_TOKEN` for temporary testing; or set `SEND_INVOICE_WEBHOOK_URL` to forward the invoice payload to your own mail service.
- For the easiest Gmail setup, paste `docs/google-apps-script-invoice-sender.js` into Google Apps Script, deploy it as a web app that executes as you, then put the web app URL in `SEND_INVOICE_WEBHOOK_URL`.
- Without Gmail credentials, the app shows a send setup error instead of pretending the invoice was sent.

## Automatic business date

1. Import `database/sql/schema.sql`; the business-date table is included and no stored procedure is required.
2. Set `APP_TIMEZONE=Asia/Manila` and a private `CRON_SECRET` in `.env`.
3. Add this with `crontab -e` (replace the URL and secret):

   ```cron
   0 0 * * * curl -fsS -X POST -H 'Content-Type: application/json' -d '{"action":"sync"}' https://YOUR_HOST/api/business-date
   ```

The controller updates the database to the current Manila date each midnight. The Business Date menu still supports a manual override, which is now saved in MariaDB for every browser.

## Database queries

The JavaScript functions use parameterized MySQL queries and transactions. The application does not require stored procedures.

## Notes
- The AI Accountant may prepare finance work, but cannot post entries, send money, or alter approved books.
- The AI CEO may recommend, delegate, and run owner-approved recurring invoice rules, but cannot approve its own sensitive actions.
- Monthly invoices send immediately when auto-send is enabled and the invoice has no exceptions. Exceptions become drafts or approvals.
- Connect real accounting, banking, Gmail, and calendar systems only behind role checks, audit logs, and owner approval.
