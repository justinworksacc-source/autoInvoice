-- Add a product or service description to each recurring invoice client.

ALTER TABLE monthly_invoice_clients
  ADD COLUMN item_type VARCHAR(20) NOT NULL DEFAULT 'Service',
  ADD COLUMN item_name VARCHAR(255) NOT NULL DEFAULT 'Monthly service charge',
  ADD COLUMN item_description VARCHAR(1000) NULL;
