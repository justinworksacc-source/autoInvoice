ALTER TABLE monthly_invoice_clients
  ADD COLUMN IF NOT EXISTS billing_address VARCHAR(500) NULL AFTER billing_email;
