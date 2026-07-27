<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

date_default_timezone_set(getenv('APP_TIMEZONE') ?: 'Asia/Manila');

$pdo = require __DIR__ . '/../db/bootstrap.php';
require_once __DIR__ . '/../controllers/BusinessDateController.php';

try {
    $result = (new BusinessDateController($pdo))->sync();
    echo sprintf(
        "[%s] Business date synchronized to %s (%s).\n",
        date(DATE_ATOM),
        $result['business_date'] ?? date('Y-m-d'),
        $result['source'] ?? 'cron'
    );
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, sprintf("[%s] Business date sync failed: %s\n", date(DATE_ATOM), $error->getMessage()));
    exit(1);
}
