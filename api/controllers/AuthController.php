<?php

final class AuthController {
    public function __construct(private PDO $pdo) {}

    public function login(string $username, string $password): array {
        $username = trim($username);
        $ipAddress = substr((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 0, 45);
        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS auth_login_attempts (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(100) NOT NULL,
                ip_address VARCHAR(45) NOT NULL,
                attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX auth_login_attempts_lookup_idx (username, ip_address, attempted_at)
            )'
        );
        $attempts = $this->pdo->prepare(
            'SELECT COUNT(*) FROM auth_login_attempts
             WHERE username = :username AND ip_address = :ip_address
               AND attempted_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)'
        );
        $attempts->execute([':username' => $username, ':ip_address' => $ipAddress]);
        if ((int) $attempts->fetchColumn() >= 5) {
            throw new DomainException('Too many login attempts. Try again in 15 minutes.');
        }
        $statement = $this->pdo->prepare(
            'SELECT id, username, password_hash FROM auth_accounts WHERE username = :username AND is_active = 1 LIMIT 1'
        );
        $statement->execute([':username' => $username]);
        $account = $statement->fetch();

        if (!$account || !password_verify($password, $account['password_hash'])) {
            $failedAttempt = $this->pdo->prepare(
                'INSERT INTO auth_login_attempts (username, ip_address) VALUES (:username, :ip_address)'
            );
            $failedAttempt->execute([':username' => $username, ':ip_address' => $ipAddress]);
            throw new DomainException('Incorrect username or password.');
        }

        $clearAttempts = $this->pdo->prepare(
            'DELETE FROM auth_login_attempts WHERE username = :username AND ip_address = :ip_address'
        );
        $clearAttempts->execute([':username' => $username, ':ip_address' => $ipAddress]);

        session_regenerate_id(true);
        $_SESSION['auth_user_id'] = (int) $account['id'];
        $_SESSION['auth_username'] = $account['username'];

        return ['username' => $account['username']];
    }

    public function current(): ?array {
        if (empty($_SESSION['auth_user_id']) || empty($_SESSION['auth_username'])) {
            return null;
        }

        return ['username' => (string) $_SESSION['auth_username']];
    }

    public function updateCredentials(string $username, string $password): array {
        $accountId = (int) ($_SESSION['auth_user_id'] ?? 0);
        $username = trim($username);

        if ($accountId < 1) {
            throw new DomainException('Authentication required.');
        }
        if (strlen($username) < 3) {
            throw new InvalidArgumentException('Username must be at least 3 characters.');
        }
        if (strlen($password) < 8) {
            throw new InvalidArgumentException('New password must be at least 8 characters.');
        }

        $statement = $this->pdo->prepare(
            'UPDATE auth_accounts SET username = :username, password_hash = :password_hash WHERE id = :id'
        );
        $statement->execute([
            ':username' => $username,
            ':password_hash' => password_hash($password, PASSWORD_DEFAULT),
            ':id' => $accountId,
        ]);
        $_SESSION['auth_username'] = $username;

        return ['username' => $username];
    }

    public function logout(): void {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
    }
}
