<?php

declare(strict_types=1);

function security_json(int $status, array $payload): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function security_is_https(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
        strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

function security_allowed_origin(): ?string {
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin === '') return null;

    $configured = array_filter(array_map('trim', explode(',', (string) (getenv('APP_ALLOWED_ORIGINS') ?: ''))));
    $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
    $sameOrigin = $host !== '' && in_array($origin, ['http://' . $host, 'https://' . $host], true);

    return ($sameOrigin || in_array($origin, $configured, true)) ? $origin : '';
}

function security_start_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('vss_session');
    session_set_cookie_params([
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => security_is_https(),
        'path' => '/',
    ]);
    session_start();

    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
}

function security_bootstrap(array $allowedMethods, bool $requireAuth = true, bool $allowValidCron = false, bool $csrfLoginExempt = false): void {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
    header('Cache-Control: no-store');

    $origin = security_allowed_origin();
    if ($origin === '') security_json(403, ['success' => false, 'error' => 'Origin not allowed.']);
    if ($origin !== null) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token, X-Cron-Secret');
    header('Access-Control-Allow-Methods: ' . implode(', ', array_unique([...$allowedMethods, 'OPTIONS'])));

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    $method = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if (!in_array($method, $allowedMethods, true)) security_json(405, ['success' => false, 'error' => 'Method not allowed.']);

    $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength > 1_048_576) security_json(413, ['success' => false, 'error' => 'Request body is too large.']);

    security_start_session();
    $cronSecret = (string) (getenv('CRON_SECRET') ?: '');
    $validCron = $allowValidCron && $cronSecret !== '' && hash_equals($cronSecret, (string) ($_SERVER['HTTP_X_CRON_SECRET'] ?? ''));

    if ($requireAuth && !$validCron && empty($_SESSION['auth_user_id'])) {
        security_json(401, ['success' => false, 'error' => 'Authentication required.']);
    }

    $isWrite = in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true);
    $loginExempt = $csrfLoginExempt && $method === 'POST' && empty($_SESSION['auth_user_id']);
    if ($isWrite && !$validCron && !$loginExempt) {
        $provided = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
        if ($provided === '' || !hash_equals((string) $_SESSION['csrf_token'], $provided)) {
            security_json(403, ['success' => false, 'error' => 'Invalid security token. Refresh and try again.']);
        }
    }
}

function security_csrf_token(): string {
    return (string) ($_SESSION['csrf_token'] ?? '');
}

function security_public_error(Throwable $error): string {
    $code = (int) $error->getCode();
    if ($error instanceof InvalidArgumentException || $error instanceof DomainException || in_array($code, [400, 401, 403, 404, 405, 409, 422], true)) {
        return $error->getMessage();
    }
    error_log($error->__toString());
    return 'An internal server error occurred.';
}
