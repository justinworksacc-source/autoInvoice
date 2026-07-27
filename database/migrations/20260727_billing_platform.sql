-- Production billing upgrade for Visual Security Systems.
-- Run after the base schema while connected to the Aiven database.

ALTER TABLE auth_accounts
  ADD COLUMN role VARCHAR(30) NOT NULL DEFAULT 'admin',
  ADD COLUMN full_name VARCHAR(255) NULL,
  ADD COLUMN last_login_at DATETIME NULL;

ALTER TABLE monthly_invoice_clients
  ADD COLUMN customer_number VARCHAR(40) NULL,
  ADD COLUMN phone VARCHAR(40) NULL,
  ADD COLUMN archived_at DATETIME NULL,
  ADD COLUMN portal_token_hash CHAR(64) NULL;

CREATE UNIQUE INDEX monthly_invoice_clients_customer_number_unique
  ON monthly_invoice_clients (company_id, customer_number);

ALTER TABLE monthly_invoice_cycles
  ADD COLUMN viewed_at DATETIME NULL,
  ADD COLUMN cancelled_at DATETIME NULL,
  ADD COLUMN cancelled_reason VARCHAR(500) NULL;

ALTER TABLE monthly_invoice_payments
  ADD COLUMN invoice_cycle_id BIGINT NULL,
  ADD COLUMN refunded_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN receipt_number VARCHAR(100) NULL;

CREATE UNIQUE INDEX monthly_invoice_payments_receipt_unique
  ON monthly_invoice_payments (company_id, receipt_number);

CREATE TABLE IF NOT EXISTS payment_refunds (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  payment_id BIGINT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'recorded',
  external_reference VARCHAR(255) NULL,
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY payment_refunds_external_unique (external_reference),
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (payment_id) REFERENCES monthly_invoice_payments(id)
);

CREATE TABLE IF NOT EXISTS billing_notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  client_id BIGINT NULL,
  invoice_cycle_id BIGINT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'email',
  notification_type VARCHAR(40) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'queued',
  attempts SMALLINT NOT NULL DEFAULT 0,
  last_error VARCHAR(1000) NULL,
  scheduled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX billing_notifications_queue_idx (status, scheduled_at),
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (client_id) REFERENCES monthly_invoice_clients(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(30) NOT NULL,
  event_key VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'processing',
  payload JSON NULL,
  error_message VARCHAR(1000) NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  UNIQUE KEY webhook_events_provider_key_unique (provider, event_key)
);

CREATE TABLE IF NOT EXISTS app_error_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NULL,
  source VARCHAR(100) NOT NULL,
  error_code VARCHAR(100) NULL,
  message VARCHAR(1000) NOT NULL,
  context JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX app_error_events_created_idx (created_at)
);
