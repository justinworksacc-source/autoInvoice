CREATE TABLE IF NOT EXISTS companies (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  tenant_key VARCHAR(100) UNIQUE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO companies (id, name, tenant_key)
VALUES (1, 'Visual Security Systems', 'visual-security-systems')
ON DUPLICATE KEY UPDATE name = VALUES(name);

CREATE TABLE IF NOT EXISTS departments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  department_id BIGINT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS auth_accounts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS auth_login_attempts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX auth_login_attempts_lookup_idx (username, ip_address, attempted_at)
);

INSERT INTO auth_accounts (username, password_hash)
VALUES ('admin.demo', '$2y$12$1.UdkTZ2Z6wBSZ.PCC8htunB.4fGrgt8pvYj.reAJThzi/Q.1I7B2')
ON DUPLICATE KEY UPDATE username = VALUES(username);

CREATE TABLE IF NOT EXISTS agent_profiles (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  agent_type VARCHAR(100) NOT NULL,
  automation_level VARCHAR(50) NOT NULL DEFAULT 'read_only',
  approval_scope JSON NULL,
  system_role TEXT NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS automation_rules (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(100) NOT NULL,
  condition_json JSON NOT NULL,
  action_json JSON NOT NULL,
  approval_required TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS business_dates (
  company_id BIGINT PRIMARY KEY,
  business_date DATE NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'automatic',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS business_profiles (
  company_id BIGINT PRIMARY KEY,
  gmail_alias VARCHAR(255) NOT NULL DEFAULT 'billing@yourcompany.com',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

INSERT INTO business_profiles (company_id, gmail_alias)
VALUES (1, 'billing@yourcompany.com')
ON DUPLICATE KEY UPDATE company_id = VALUES(company_id);

CREATE TABLE IF NOT EXISTS approvals (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id BIGINT NOT NULL,
  action_name VARCHAR(100) NOT NULL,
  requested_by BIGINT NOT NULL,
  approved_by BIGINT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  reason TEXT NULL,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at DATETIME NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  actor_type VARCHAR(50) NOT NULL,
  actor_id BIGINT NULL,
  agent_name VARCHAR(100) NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id BIGINT NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  approval_state VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  thread_id VARCHAR(100) NOT NULL,
  context_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  sender_type VARCHAR(50) NOT NULL,
  sender_id BIGINT NULL,
  content TEXT NOT NULL,
  agent_name VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  due_at DATETIME NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  source_type VARCHAR(100) NOT NULL DEFAULT 'manual',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS business_objectives (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  requested_by BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  business_goal TEXT NOT NULL,
  autonomy_level VARCHAR(50) NOT NULL DEFAULT 'prepare',
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (requested_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS agent_work_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  objective_id BIGINT NOT NULL,
  assigned_agent VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  detail TEXT NULL,
  output_summary TEXT NULL,
  risk_level VARCHAR(50) NOT NULL DEFAULT 'low',
  approval_id BIGINT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (objective_id) REFERENCES business_objectives(id),
  FOREIGN KEY (approval_id) REFERENCES approvals(id)
);

CREATE TABLE IF NOT EXISTS invoice_email_rules (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  created_by BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  billing_day TINYINT NOT NULL DEFAULT 1,
  send_time TIME NOT NULL DEFAULT '09:00:00',
  due_after_days SMALLINT NOT NULL DEFAULT 14,
  from_alias VARCHAR(255) NOT NULL,
  customer_filter_json JSON NOT NULL,
  email_template_json JSON NOT NULL,
  auto_send_enabled TINYINT(1) NOT NULL DEFAULT 0,
  approval_required_for_exceptions TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS monthly_invoice_clients (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  billing_email VARCHAR(255) NOT NULL,
  billing_address VARCHAR(500) NULL,
  invoice_number VARCHAR(100) NOT NULL,
  monthly_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  start_date DATE NULL,
  billing_day TINYINT NOT NULL DEFAULT 1,
  due_after_days SMALLINT NOT NULL DEFAULT 14,
  last_sent_at DATETIME NULL,
  last_sent_due_date DATE NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  UNIQUE KEY monthly_invoice_clients_company_email_unique (company_id, billing_email),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS monthly_invoice_cycles (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  client_id BIGINT NOT NULL,
  invoice_number VARCHAR(100) NOT NULL,
  billing_period VARCHAR(20) NOT NULL,
  cycle_start_date DATE NOT NULL,
  due_date DATE NOT NULL,
  monthly_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  previous_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  balance_due DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(50) NOT NULL DEFAULT 'unpaid',
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  UNIQUE KEY monthly_invoice_cycles_client_period_unique (client_id, billing_period),
  INDEX monthly_invoice_cycles_company_due_status_idx (company_id, due_date, status),
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (client_id) REFERENCES monthly_invoice_clients(id)
);

CREATE TABLE IF NOT EXISTS monthly_invoice_payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  client_id BIGINT NULL,
  billing_email VARCHAR(255) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  payment_date DATE NOT NULL,
  method VARCHAR(50) NOT NULL DEFAULT 'cash',
  reference_number VARCHAR(255) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX monthly_invoice_payments_company_date_idx (company_id, payment_date),
  INDEX monthly_invoice_payments_client_date_idx (client_id, payment_date),
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (client_id) REFERENCES monthly_invoice_clients(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS xendit_payment_sessions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  client_id BIGINT NULL,
  billing_email VARCHAR(255) NOT NULL,
  reference_id VARCHAR(100) NOT NULL,
  payment_session_id VARCHAR(100) NULL,
  payment_id VARCHAR(100) NULL,
  webhook_id VARCHAR(255) NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'PHP',
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  payment_link_url VARCHAR(1000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  UNIQUE KEY xendit_payment_sessions_reference_unique (reference_id),
  UNIQUE KEY xendit_payment_sessions_webhook_unique (webhook_id),
  INDEX xendit_payment_sessions_company_status_idx (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (client_id) REFERENCES monthly_invoice_clients(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS invoice_email_runs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  rule_id BIGINT NOT NULL,
  billing_period VARCHAR(20) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  invoice_count INT NOT NULL DEFAULT 0,
  exception_count INT NOT NULL DEFAULT 0,
  gmail_draft_count INT NOT NULL DEFAULT 0,
  gmail_sent_count INT NOT NULL DEFAULT 0,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (rule_id) REFERENCES invoice_email_rules(id)
);

CREATE TABLE IF NOT EXISTS invoice_email_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  run_id BIGINT NOT NULL,
  approval_id BIGINT NULL,
  customer_reference VARCHAR(100) NOT NULL,
  invoice_number VARCHAR(100) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  gmail_message_id VARCHAR(255) NULL,
  gmail_draft_id VARCHAR(255) NULL,
  subject VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  exception_reason TEXT NULL,
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (run_id) REFERENCES invoice_email_runs(id),
  FOREIGN KEY (approval_id) REFERENCES approvals(id)
);

-- Remove procedures left by older releases. Current controllers use prepared SQL directly.
DROP PROCEDURE IF EXISTS sp_set_business_date;
DROP PROCEDURE IF EXISTS sp_dashboard_summary;
DROP PROCEDURE IF EXISTS sp_accountant_clients;
DROP PROCEDURE IF EXISTS sp_accountant_recent_payments;
DROP PROCEDURE IF EXISTS sp_accountant_review_count;
DROP PROCEDURE IF EXISTS sp_get_business_profile;
DROP PROCEDURE IF EXISTS sp_update_business_profile;
