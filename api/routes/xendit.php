<?php

declare(strict_types=1);

require_once __DIR__ . '/../security.php';
$pdo = require __DIR__ . '/../db/bootstrap.php';

function xendit_json(int $status, array $payload): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function xendit_header(string $name): string {
    $serverName = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return trim((string) ($_SERVER[$serverName] ?? ''));
}

function xendit_api_request(array $payload): array {
    $secretKey = trim((string) (getenv('XENDIT_SECRET_KEY') ?: ''));
    if ($secretKey === '') {
        throw new RuntimeException('Xendit is not configured. Add XENDIT_SECRET_KEY to .env.', 422);
    }
    if (!function_exists('curl_init')) {
        throw new RuntimeException('The PHP cURL extension is required for Xendit.', 500);
    }

    $handle = curl_init('https://api.xendit.co/sessions');
    curl_setopt_array($handle, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => [
            'Authorization: Basic ' . base64_encode($secretKey . ':'),
            'Content-Type: application/json',
            'Idempotency-Key: ' . $payload['reference_id'],
        ],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_SLASHES),
    ]);
    $body = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    $curlError = curl_error($handle);
    curl_close($handle);

    if ($body === false) {
        throw new RuntimeException('Could not connect to Xendit: ' . $curlError, 502);
    }

    $result = json_decode($body, true);
    if ($status < 200 || $status >= 300 || !is_array($result)) {
        $message = is_array($result) ? ($result['message'] ?? $result['error_code'] ?? 'Xendit rejected the request.') : 'Invalid response from Xendit.';
        throw new RuntimeException((string) $message, $status >= 400 && $status < 500 ? 422 : 502);
    }
    return $result;
}

function create_xendit_session(PDO $pdo): never {
    security_bootstrap(['POST']);
    $input = json_decode((string) file_get_contents('php://input'), true);
    $email = strtolower(trim((string) ($input['client_id'] ?? '')));
    $amount = round((float) preg_replace('/[^0-9.-]/', '', (string) ($input['amount'] ?? '0')), 2);

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $amount <= 0) {
        throw new InvalidArgumentException('A valid customer and positive payment amount are required.', 422);
    }

    $statement = $pdo->prepare(
        'SELECT id, customer_name, billing_email, invoice_number
         FROM monthly_invoice_clients WHERE company_id = 1 AND LOWER(billing_email) = :email LIMIT 1'
    );
    $statement->execute([':email' => $email]);
    $client = $statement->fetch();
    if (!$client) {
        throw new RuntimeException('Customer was not found.', 404);
    }

    $referenceId = 'VSS-' . date('YmdHis') . '-' . bin2hex(random_bytes(4));
    $baseUrl = rtrim((string) (getenv('APP_PUBLIC_URL') ?: ''), '/');
    if ($baseUrl === '') {
        $scheme = security_is_https() ? 'https' : 'http';
        $baseUrl = $scheme . '://' . (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
    }

    $customerReference = 'client' . $client['id'];
    $givenNames = preg_replace('/[^A-Za-z0-9 ]/', '', (string) $client['customer_name']);
    $requestPayload = [
        'reference_id' => $referenceId,
        'session_type' => 'PAY',
        'mode' => 'PAYMENT_LINK',
        'amount' => $amount,
        'currency' => 'PHP',
        'country' => 'PH',
        'locale' => 'en',
        'capture_method' => 'AUTOMATIC',
        'allow_save_payment_method' => 'DISABLED',
        'customer' => [
            'reference_id' => $customerReference,
            'type' => 'INDIVIDUAL',
            'email' => $client['billing_email'],
            'individual_detail' => ['given_names' => substr(trim($givenNames) ?: 'Customer', 0, 50)],
        ],
        'description' => 'Payment for invoice ' . $client['invoice_number'],
        'metadata' => ['client_email' => $email, 'invoice_number' => (string) $client['invoice_number']],
    ];
    if (str_starts_with($baseUrl, 'https://')) {
        $requestPayload['success_return_url'] = $baseUrl . '/accountant/customers?payment=success';
        $requestPayload['cancel_return_url'] = $baseUrl . '/accountant/customers?payment=cancelled';
    }
    $session = xendit_api_request($requestPayload);

    $insert = $pdo->prepare(
        'INSERT INTO xendit_payment_sessions
         (company_id, client_id, billing_email, reference_id, payment_session_id, amount, currency, status, payment_link_url)
         VALUES (1, :client_id, :email, :reference_id, :session_id, :amount, "PHP", :status, :payment_url)'
    );
    $insert->execute([
        ':client_id' => $client['id'],
        ':email' => $email,
        ':reference_id' => $referenceId,
        ':session_id' => $session['payment_session_id'] ?? null,
        ':amount' => $amount,
        ':status' => strtolower((string) ($session['status'] ?? 'ACTIVE')),
        ':payment_url' => $session['payment_link_url'] ?? null,
    ]);

    if (empty($session['payment_link_url'])) {
        throw new RuntimeException('Xendit did not return a checkout URL.', 502);
    }
    xendit_json(201, ['success' => true, 'payment_url' => $session['payment_link_url']]);
}

function handle_xendit_webhook(PDO $pdo): never {
    header('Content-Type: application/json; charset=utf-8');
    $expectedToken = trim((string) (getenv('XENDIT_WEBHOOK_TOKEN') ?: ''));
    $receivedToken = xendit_header('x-callback-token');
    if ($expectedToken === '' || $receivedToken === '' || !hash_equals($expectedToken, $receivedToken)) {
        xendit_json(401, ['success' => false, 'error' => 'Invalid webhook token.']);
    }

    $payload = json_decode((string) file_get_contents('php://input'), true);
    $event = strtolower((string) ($payload['event'] ?? ''));
    $data = is_array($payload['data'] ?? null) ? $payload['data'] : [];
    $referenceId = (string) ($data['reference_id'] ?? $payload['reference_id'] ?? '');
    $webhookId = xendit_header('webhook-id');

    if ($referenceId === '' || !in_array($event, ['payment_session.completed', 'payment.succeeded'], true)) {
        xendit_json(200, ['success' => true, 'ignored' => true]);
    }

    $pdo->beginTransaction();
    try {
        $lookup = $pdo->prepare('SELECT * FROM xendit_payment_sessions WHERE reference_id = :reference_id FOR UPDATE');
        $lookup->execute([':reference_id' => $referenceId]);
        $session = $lookup->fetch();
        if (!$session || $session['status'] === 'paid') {
            $pdo->commit();
            xendit_json(200, ['success' => true, 'duplicate' => true]);
        }

        $paymentId = (string) ($data['payment_id'] ?? $data['id'] ?? '');
        $payment = $pdo->prepare(
            'INSERT INTO monthly_invoice_payments
             (company_id, client_id, billing_email, amount, payment_date, method, reference_number, notes)
             VALUES (1, :client_id, :email, :amount, CURDATE(), "Xendit", :reference, "Confirmed automatically by Xendit webhook")'
        );
        $payment->execute([
            ':client_id' => $session['client_id'],
            ':email' => $session['billing_email'],
            ':amount' => $session['amount'],
            ':reference' => $paymentId ?: $referenceId,
        ]);
        $update = $pdo->prepare(
            'UPDATE xendit_payment_sessions SET status = "paid", payment_id = :payment_id,
             webhook_id = :webhook_id, paid_at = NOW() WHERE id = :id'
        );
        $update->execute([
            ':payment_id' => $paymentId ?: null,
            ':webhook_id' => $webhookId ?: null,
            ':id' => $session['id'],
        ]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    xendit_json(200, ['success' => true]);
}

try {
    if (isset($_GET['webhook'])) {
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') xendit_json(405, ['success' => false, 'error' => 'Method not allowed.']);
        handle_xendit_webhook($pdo);
    }
    create_xendit_session($pdo);
} catch (Throwable $error) {
    $status = (int) $error->getCode();
    xendit_json($status >= 400 && $status <= 599 ? $status : 500, [
        'success' => false,
        'error' => security_public_error($error),
    ]);
}
