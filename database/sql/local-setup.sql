CREATE DATABASE IF NOT EXISTS systemt_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'ai_agent'@'localhost' IDENTIFIED BY 'ai_agent_local';
CREATE USER IF NOT EXISTS 'ai_agent'@'127.0.0.1' IDENTIFIED BY 'ai_agent_local';

GRANT ALL PRIVILEGES ON systemt_ai.* TO 'ai_agent'@'localhost';
GRANT ALL PRIVILEGES ON systemt_ai.* TO 'ai_agent'@'127.0.0.1';

FLUSH PRIVILEGES;
