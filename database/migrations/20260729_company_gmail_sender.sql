-- Persist the company Gmail sender so every signed-in device uses the same address.

ALTER TABLE companies
  ADD COLUMN gmail_sender_email VARCHAR(255) NULL;
