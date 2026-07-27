<?php
require_once __DIR__ . '/../security.php';
security_bootstrap(['GET', 'PUT']);

try {
    $pdo = require __DIR__ . '/../db/bootstrap.php';
    require_once __DIR__ . '/../controllers/ProfileController.php';
    $controller = new ProfileController($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $profile = $controller->show();
    } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $profile = $controller->update(json_decode(file_get_contents('php://input'), true) ?: []);
    } else {
        throw new RuntimeException('Method not allowed', 405);
    }

    echo json_encode(['success' => true, 'profile' => $profile], JSON_PRETTY_PRINT);
} catch (InvalidArgumentException $e) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => $e->getMessage()], JSON_PRETTY_PRINT);
} catch (Throwable $e) {
    http_response_code($e->getCode() === 405 ? 405 : 500);
    echo json_encode(['success' => false, 'error' => security_public_error($e)], JSON_PRETTY_PRINT);
}
