<?php

declare(strict_types=1);

$projectRoot = dirname(__DIR__);
$distRoot = $projectRoot . '/dist';
$requestPath = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');

if (str_starts_with($requestPath, '/api/')) {
    $apiRoot = realpath($projectRoot . '/api');
    $apiFile = realpath($projectRoot . $requestPath);

    if ($apiRoot && $apiFile && str_starts_with($apiFile, $apiRoot . DIRECTORY_SEPARATOR) && is_file($apiFile) && pathinfo($apiFile, PATHINFO_EXTENSION) === 'php') {
        require $apiFile;
        return true;
    }

    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'API route not found.']);
    return true;
}

$publicFiles = [
    '/logo.png' => $projectRoot . '/logo.png',
    '/invoice-logo.jpg' => $projectRoot . '/invoice-logo.jpg',
];
$staticFile = $publicFiles[$requestPath] ?? realpath($distRoot . $requestPath);
$realDistRoot = realpath($distRoot);
$isDistFile = $realDistRoot && $staticFile && str_starts_with((string) $staticFile, $realDistRoot . DIRECTORY_SEPARATOR);

if ($staticFile && is_file($staticFile) && ($isDistFile || isset($publicFiles[$requestPath]))) {
    $contentTypes = [
        'css' => 'text/css; charset=utf-8',
        'js' => 'text/javascript; charset=utf-8',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
    ];
    header('Content-Type: ' . ($contentTypes[strtolower(pathinfo($staticFile, PATHINFO_EXTENSION))] ?? 'application/octet-stream'));
    readfile($staticFile);
    return true;
}

$indexFile = $distRoot . '/index.html';
if (!is_file($indexFile)) {
    http_response_code(503);
    echo 'Production build is missing. Run npm run build first.';
    return true;
}

header('Content-Type: text/html; charset=utf-8');
readfile($indexFile);
return true;
