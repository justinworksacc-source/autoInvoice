<?php
require_once __DIR__ . '/../security.php';
security_bootstrap(['GET']);

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        throw new RuntimeException('Method not allowed', 405);
    }

    $pdo = require __DIR__ . '/../db/bootstrap.php';
    require_once __DIR__ . '/../controllers/DashboardController.php';
    echo json_encode(['success' => true, 'dashboard' => (new DashboardController($pdo))->index()], JSON_PRETTY_PRINT);
} catch (Throwable $e) {
    http_response_code($e->getCode() === 405 ? 405 : 500);
    echo json_encode(['success' => false, 'error' => security_public_error($e)], JSON_PRETTY_PRINT);
}
