<?php
require_once __DIR__ . '/../security.php';
security_bootstrap(['GET', 'POST', 'PUT', 'DELETE'], false, false, true);

try {
    $pdo = require __DIR__ . '/../db/bootstrap.php';
    require_once __DIR__ . '/../controllers/AuthController.php';
    $controller = new AuthController($pdo);
    $payload = json_decode(file_get_contents('php://input'), true) ?: [];

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $user = $controller->login((string) ($payload['username'] ?? ''), (string) ($payload['password'] ?? ''));
    } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $user = $controller->current();
        if (!$user) { http_response_code(401); }
    } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $user = $controller->updateCredentials((string) ($payload['username'] ?? ''), (string) ($payload['password'] ?? ''));
    } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $controller->logout();
        echo json_encode(['success' => true]);
        exit;
    } else {
        throw new RuntimeException('Method not allowed', 405);
    }

    echo json_encode(['success' => (bool) $user, 'user' => $user, 'csrf_token' => security_csrf_token()]);
} catch (DomainException $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
} catch (InvalidArgumentException $e) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
} catch (Throwable $e) {
    http_response_code($e->getCode() === 405 ? 405 : 500);
    echo json_encode(['success' => false, 'error' => security_public_error($e)]);
}
