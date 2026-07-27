<?php
require_once __DIR__ . '/../security.php';
security_bootstrap(['POST']);

$payload = json_decode(file_get_contents('php://input'), true) ?: [];

function clean_header_value($value) {
    return trim(str_replace(["\r", "\n"], '', (string) $value));
}

function mail_address($name, $email) {
    $safeName = str_replace('"', "'", clean_header_value($name));
    $safeEmail = clean_header_value($email);

    return '"' . $safeName . '" <' . $safeEmail . '>';
}

function required_payload_value($payload, $key) {
    return trim((string) ($payload[$key] ?? ''));
}

function json_error($statusCode, $message, $extra = []) {
    http_response_code($statusCode);
    echo json_encode(array_merge([
        'success' => false,
        'error' => $message
    ], $extra), JSON_PRETTY_PRINT);
    exit;
}

function curl_json($url, $headers, $body) {
    if (!function_exists('curl_init')) {
        json_error(500, 'PHP cURL is not installed on this server.');
    }

    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => is_string($body) ? $body : json_encode($body),
        CURLOPT_TIMEOUT => 25
    ]);

    $rawResponse = curl_exec($handle);
    $error = curl_error($handle);
    $statusCode = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    curl_close($handle);

    if ($rawResponse === false) {
        json_error(502, 'Could not contact the Gmail sender service.', ['detail' => $error]);
    }

    $decoded = json_decode($rawResponse, true);

    return [
        'status_code' => $statusCode,
        'body' => $decoded,
        'raw_body' => $rawResponse
    ];
}

function base64url_encode_string($value) {
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function pdf_escape($value) {
    return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], (string) $value);
}

function build_invoice_pdf($invoice) {
    $company = $invoice['company_name'] ?: 'Your Company';
    $customer = $invoice['to_name'] ?: 'Customer';
    $email = $invoice['to'] ?: '';
    $address = $invoice['customer_address'] ?? '';
    $amount = $invoice['amount'] ?: '0.00';
    $monthlyAmount = $invoice['monthly_amount'] ?: $amount;
    $previousBalance = $invoice['previous_balance'] ?: '0.00';
    $dueDate = $invoice['due_date'] ?: '';
    $today = date('Y-m-d');

    $text = function ($value, $x, $y, $size, $font = 'F1', $color = '0.10 0.16 0.25') {
        return "BT\n{$color} rg\n/{$font} {$size} Tf\n{$x} {$y} Td\n(" . pdf_escape($value) . ") Tj\nET\n";
    };
    $rect = function ($x, $y, $width, $height, $color) {
        return "{$color} rg\n{$x} {$y} {$width} {$height} re\nf\n";
    };
    $strokeLine = function ($x1, $y1, $x2, $y2, $color, $width = 1) {
        return "{$color} RG\n{$width} w\n{$x1} {$y1} m\n{$x2} {$y2} l\nS\n";
    };

    $content = '';
    $content .= $rect(0, 0, 612, 792, '1 1 1');
    $content .= $rect(0, 790, 612, 2, '0.02 0.27 0.70');
    $content .= "q\n76 0 0 76 26 688 cm\n/Im1 Do\nQ\n";
    $content .= $text('VSS-IT', 110, 748, 25, 'F2', '0.03 0.07 0.13');
    $content .= $text($company, 110, 724, 9, 'F1', '0.15 0.20 0.28');
    $content .= $text($invoice['from_alias'], 110, 707, 9, 'F1', '0.15 0.20 0.28');
    $content .= $text('INVOICE', 390, 720, 36, 'F2', '0.01 0.03 0.06');
    $content .= $text('Invoice Number', 298, 672, 10, 'F1');
    $content .= $text($invoice['invoice_number'], 445, 672, 10, 'F2');
    $content .= $strokeLine(442, 662, 566, 662, '0.55 0.65 0.82', 0.6);
    $content .= $text('Invoice Date', 298, 642, 10, 'F1');
    $content .= $text($today, 445, 642, 10, 'F2');
    $content .= $strokeLine(442, 632, 566, 632, '0.55 0.65 0.82', 0.6);
    $content .= $text('Due Date', 298, 612, 10, 'F1');
    $content .= $text($dueDate, 445, 612, 10, 'F2');
    $content .= $strokeLine(442, 602, 566, 602, '0.55 0.65 0.82', 0.6);

    $content .= "0.02 0.27 0.70 RG\n1 w\n24 438 378 142 re\nS\n";
    $content .= $text('BILL TO', 56, 552, 12, 'F2', '0.03 0.07 0.13');
    $content .= $text('Customer Name', 38, 522, 9, 'F1');
    $content .= $text($customer, 205, 522, 10, 'F2');
    $content .= $strokeLine(202, 512, 390, 512, '0.55 0.65 0.82', 0.5);
    $content .= $text('Email', 38, 488, 9, 'F1');
    $content .= $text($email, 205, 488, 10, 'F2');
    $content .= $strokeLine(202, 478, 390, 478, '0.55 0.65 0.82', 0.5);
    $content .= $text('Address', 38, 454, 9, 'F1');
    $content .= $text($address, 205, 454, 9, 'F2');
    $content .= $strokeLine(202, 444, 390, 444, '0.55 0.65 0.82', 0.5);

    $content .= $rect(24, 380, 542, 32, '0.02 0.27 0.70');
    $content .= $text('DESCRIPTION', 130, 391, 9, 'F2', '0 0 0');
    $content .= $text('QTY', 350, 391, 9, 'F2', '0 0 0');
    $content .= $text('UNIT PRICE', 414, 391, 9, 'F2', '0 0 0');
    $content .= $text('AMOUNT', 516, 391, 9, 'F2', '0 0 0');
    foreach ([292, 322, 352, 380] as $lineY) { $content .= $strokeLine(24, $lineY, 566, $lineY, '0.35 0.43 0.56', 0.5); }
    foreach ([24, 324, 380, 500, 566] as $lineX) { $content .= $strokeLine($lineX, 292, $lineX, 412, '0.35 0.43 0.56', 0.5); }
    $content .= $text('Monthly IT & Security Services', 30, 362, 9, 'F1');
    $content .= $text('1', 367, 362, 9, 'F1');
    $content .= $text($monthlyAmount, 447, 362, 9, 'F1');
    $content .= $text($amount, 522, 362, 9, 'F2');

    $content .= $rect(48, 184, 220, 62, '0.96 0.98 1.00');
    $content .= $text('PAYMENT TERMS', 62, 225, 10, 'F2', '0.02 0.27 0.70');
    $content .= $text('Payment is due by ' . $dueDate . '.', 62, 204, 9, 'F1');
    $content .= $text('SUBTOTAL', 350, 241, 9, 'F2');
    $content .= $text($amount, 510, 241, 9, 'F1');
    $content .= $text('TAX (0%)', 350, 222, 9, 'F2');
    $content .= $text('0.00', 510, 222, 9, 'F1');
    $content .= $text('DISCOUNT', 350, 203, 9, 'F2');
    $content .= $text('0.00', 510, 203, 9, 'F1');
    $content .= $rect(335, 166, 229, 29, '0.02 0.27 0.70');
    $content .= $text('TOTAL DUE', 350, 176, 13, 'F2', '1 1 1');
    $content .= $text($amount, 500, 176, 13, 'F2', '1 1 1');

    $content .= $strokeLine(48, 142, 564, 142, '0.02 0.27 0.70');
    $content .= $strokeLine(48, 112, 564, 112, '0.55 0.61 0.70', 0.5);
    $content .= $text('NOTES', 60, 126, 10, 'F2', '0.02 0.27 0.70');
    $content .= $text('Thank you for your business. Please keep this invoice for your records.', 110, 126, 9, 'F1');
    $content .= $text('Authorized Signature', 350, 76, 18, 'F1', '0.08 0.12 0.22');
    $content .= $strokeLine(325, 66, 545, 66, '0.02 0.27 0.70');
    $content .= $text('AUTHORIZED SIGNATURE', 380, 50, 8, 'F2', '0.02 0.27 0.70');

    $logoPath = dirname(__DIR__, 2) . '/invoice-logo.jpg';
    $logoBytes = is_readable($logoPath) ? file_get_contents($logoPath) : '';

    $objects = [
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << /Im1 7 0 R >> >> /Contents 4 0 R >>\nendobj\n",
        "4 0 obj\n<< /Length " . strlen($content) . " >>\nstream\n{$content}endstream\nendobj\n",
        "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
        "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
        "7 0 obj\n<< /Type /XObject /Subtype /Image /Width 500 /Height 500 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " . strlen($logoBytes) . " >>\nstream\n{$logoBytes}\nendstream\nendobj\n"
    ];

    $pdf = "%PDF-1.4\n";
    $offsets = [0];

    foreach ($objects as $object) {
        $offsets[] = strlen($pdf);
        $pdf .= $object;
    }

    $xrefOffset = strlen($pdf);
    $pdf .= "xref\n0 " . (count($objects) + 1) . "\n";
    $pdf .= "0000000000 65535 f \n";

    for ($index = 1; $index <= count($objects); $index++) {
        $pdf .= sprintf("%010d 00000 n \n", $offsets[$index]);
    }

    $pdf .= "trailer\n<< /Size " . (count($objects) + 1) . " /Root 1 0 R >>\n";
    $pdf .= "startxref\n{$xrefOffset}\n%%EOF";

    return $pdf;
}

function get_gmail_access_token() {
    $directToken = getenv('GMAIL_ACCESS_TOKEN');

    if ($directToken) {
        return $directToken;
    }

    $clientId = getenv('GMAIL_CLIENT_ID');
    $clientSecret = getenv('GMAIL_CLIENT_SECRET');
    $refreshToken = getenv('GMAIL_REFRESH_TOKEN');

    if (!$clientId || !$clientSecret || !$refreshToken) {
        return null;
    }

    $tokenResponse = curl_json(
        'https://oauth2.googleapis.com/token',
        ['Content-Type: application/x-www-form-urlencoded'],
        http_build_query([
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'refresh_token' => $refreshToken,
            'grant_type' => 'refresh_token'
        ])
    );

    if ($tokenResponse['status_code'] < 200 || $tokenResponse['status_code'] >= 300 || empty($tokenResponse['body']['access_token'])) {
        json_error(502, 'Gmail OAuth refresh failed.', ['gmail_response' => $tokenResponse['body'] ?? $tokenResponse['raw_body']]);
    }

    return $tokenResponse['body']['access_token'];
}

function build_mime_message($invoice, $pdfBytes) {
    $boundary = 'invoice_' . bin2hex(random_bytes(12));
    $fromName = clean_header_value($invoice['company_name']);
    $fromAlias = clean_header_value($invoice['from_alias']);
    $toName = clean_header_value($invoice['to_name']);
    $to = clean_header_value($invoice['to']);
    $subject = clean_header_value($invoice['subject']);
    $fileName = clean_header_value($invoice['invoice_number']) . '.pdf';

    $headers = [
        'From: ' . mail_address($fromName, $fromAlias),
        'To: ' . mail_address($toName, $to),
        "Subject: {$subject}",
        'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="' . $boundary . '"'
    ];

    $message = implode("\r\n", $headers) . "\r\n\r\n";
    $message .= "--{$boundary}\r\n";
    $message .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $message .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
    $message .= $invoice['body'] . "\r\n\r\n";
    $message .= "--{$boundary}\r\n";
    $message .= "Content-Type: application/pdf; name=\"{$fileName}\"\r\n";
    $message .= "Content-Disposition: attachment; filename=\"{$fileName}\"\r\n";
    $message .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $message .= chunk_split(base64_encode($pdfBytes), 76, "\r\n");
    $message .= "--{$boundary}--";

    return $message;
}

$invoice = [
    'to' => required_payload_value($payload, 'to'),
    'to_name' => required_payload_value($payload, 'to_name') ?: 'Customer',
    'from_alias' => required_payload_value($payload, 'from_alias'),
    'company_name' => required_payload_value($payload, 'company_name') ?: 'Your Company',
    'invoice_number' => required_payload_value($payload, 'invoice_number'),
    'monthly_amount' => required_payload_value($payload, 'monthly_amount'),
    'previous_balance' => required_payload_value($payload, 'previous_balance'),
    'amount' => required_payload_value($payload, 'amount') ?: '0.00',
    'billing_day' => required_payload_value($payload, 'billing_day') ?: '1',
    'due_date' => required_payload_value($payload, 'due_date'),
    'subject' => required_payload_value($payload, 'subject'),
    'body' => (string) ($payload['body'] ?? '')
];

if (!filter_var($invoice['to'], FILTER_VALIDATE_EMAIL)) {
    json_error(422, 'Customer Gmail / billing email is invalid.');
}

if (!filter_var($invoice['from_alias'], FILTER_VALIDATE_EMAIL)) {
    json_error(422, 'Profile Gmail sender email is invalid.');
}

if ($invoice['invoice_number'] === '') {
    json_error(422, 'Invoice number is required.');
}

if ($invoice['subject'] === '') {
    $invoice['subject'] = 'Invoice ' . $invoice['invoice_number'] . ' from ' . $invoice['company_name'];
}

if (trim($invoice['body']) === '') {
    $invoice['body'] = "Hi {$invoice['to_name']},\n\nAttached is your invoice {$invoice['invoice_number']}.\n\nThank you,\n{$invoice['company_name']}";
}

$webhookUrl = getenv('SEND_INVOICE_WEBHOOK_URL');

if ($webhookUrl) {
    $webhookResponse = curl_json($webhookUrl, ['Content-Type: application/json'], [
        'secret' => getenv('SEND_INVOICE_SECRET') ?: '',
        'invoice' => $invoice,
        'attachment' => [
            'file_name' => $invoice['invoice_number'] . '.pdf',
            'content_type' => 'application/pdf',
            'content_base64' => base64_encode(build_invoice_pdf($invoice))
        ]
    ]);

    if (!$webhookResponse['body']) {
        json_error(502, 'Invoice sender webhook did not return JSON. Check that the Apps Script Web app URL ends with /exec and access is set to Anyone.', [
            'webhook_status' => $webhookResponse['status_code'],
            'webhook_body_preview' => substr($webhookResponse['raw_body'], 0, 240)
        ]);
    }

    if ($webhookResponse['status_code'] < 200 || $webhookResponse['status_code'] >= 300 || (($webhookResponse['body']['success'] ?? false) !== true)) {
        json_error(502, $webhookResponse['body']['error'] ?? 'Invoice sender webhook failed.', [
            'webhook_status' => $webhookResponse['status_code'],
            'webhook_response' => $webhookResponse['body']
        ]);
    }

    echo json_encode([
        'success' => true,
        'provider' => 'webhook',
        'message_id' => $webhookResponse['body']['message_id'] ?? null,
        'invoice_number' => $invoice['invoice_number']
    ], JSON_PRETTY_PRINT);
    exit;
}

$accessToken = get_gmail_access_token();

if (!$accessToken) {
    json_error(503, 'Gmail sender is not configured. Add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN on the PHP server, or set SEND_INVOICE_WEBHOOK_URL.');
}

$mimeMessage = build_mime_message($invoice, build_invoice_pdf($invoice));
$gmailResponse = curl_json(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ],
    [
        'raw' => base64url_encode_string($mimeMessage)
    ]
);

if ($gmailResponse['status_code'] < 200 || $gmailResponse['status_code'] >= 300) {
    json_error(502, 'Gmail rejected the invoice email.', ['gmail_response' => $gmailResponse['body'] ?? $gmailResponse['raw_body']]);
}

echo json_encode([
    'success' => true,
    'provider' => 'gmail_api',
    'message_id' => $gmailResponse['body']['id'] ?? null,
    'invoice_number' => $invoice['invoice_number'],
    'sent_to' => $invoice['to']
], JSON_PRETTY_PRINT);
