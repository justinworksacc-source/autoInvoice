<?php
require_once __DIR__ . '/../security.php';
security_bootstrap(['GET', 'POST'], true, true);

date_default_timezone_set(getenv('APP_TIMEZONE') ?: 'Asia/Manila');
$pdo = require __DIR__ . '/../db/bootstrap.php';
require_once __DIR__ . '/../controllers/BusinessDateController.php';

function business_date_response(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_PRETTY_PRINT);
    exit;
}

try {
    $controller = new BusinessDateController($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        business_date_response(200, ['success' => true] + $controller->show());
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        business_date_response(405, ['success' => false, 'error' => 'Method not allowed']);
    }

    $payload = json_decode(file_get_contents('php://input'), true) ?: [];
    $action = (string) ($payload['action'] ?? '');

    if ($action === 'sync') {
        $configuredSecret = (string) (getenv('CRON_SECRET') ?: '');
        $providedSecret = (string) ($_SERVER['HTTP_X_CRON_SECRET'] ?? $payload['secret'] ?? '');

        if ($configuredSecret !== '' && !hash_equals($configuredSecret, $providedSecret)) {
            business_date_response(401, ['success' => false, 'error' => 'Invalid cron secret']);
        }

        business_date_response(200, ['success' => true] + $controller->sync());
    }

    if ($action === 'set') {
        business_date_response(200, ['success' => true] + $controller->setManual((string) ($payload['business_date'] ?? '')));
    }

    business_date_response(422, ['success' => false, 'error' => 'Unknown business date action']);
} catch (InvalidArgumentException $e) {
    business_date_response(422, ['success' => false, 'error' => $e->getMessage()]);
} catch (Throwable $e) {
    business_date_response(500, ['success' => false, 'error' => security_public_error($e)]);
}
