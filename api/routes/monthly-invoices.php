<?php
require_once __DIR__ . '/../security.php';
security_bootstrap(['GET', 'POST']);

$pdo = require __DIR__ . '/../db/bootstrap.php';

function json_response($statusCode, $payload) {
    http_response_code($statusCode);
    echo json_encode($payload, JSON_PRETTY_PRINT);
    exit;
}

function clean_value($value) {
    return trim((string) ($value ?? ''));
}

function title_status($status) {
    $cleanStatus = strtolower(clean_value($status));

    if ($cleanStatus === 'draft') {
        return 'Draft';
    }

    if ($cleanStatus === 'sent') {
        return 'Sent';
    }

    if ($cleanStatus === 'needs approval' || $cleanStatus === 'needs_approval') {
        return 'Needs approval';
    }

    return 'Scheduled';
}

function db_status($status) {
    return strtolower(title_status($status));
}

function date_or_null($value) {
    $cleanValue = clean_value($value);

    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $cleanValue) ? $cleanValue : null;
}

function decimal_value($value) {
    $cleanValue = preg_replace('/[^0-9.-]/', '', clean_value($value));

    return is_numeric($cleanValue) ? $cleanValue : '0.00';
}

function int_value($value, $fallback, $min, $max) {
    $number = is_numeric($value) ? (int) $value : $fallback;

    return min($max, max($min, $number));
}

function ensure_company($pdo) {
    $statement = $pdo->prepare(
        "INSERT INTO companies (id, name, tenant_key)
         VALUES (1, 'Visual Security Systems', 'visual-security-systems')
         ON DUPLICATE KEY UPDATE name = VALUES(name)"
    );
    $statement->execute();
}

function read_store($pdo) {
    ensure_company($pdo);

    $clientStatement = $pdo->prepare(
        "SELECT
            LOWER(billing_email) AS id,
            customer_name AS name,
            billing_email AS email,
            COALESCE(billing_address, '') AS address,
            invoice_number AS invoiceNumber,
            CAST(monthly_amount AS CHAR) AS amount,
            COALESCE(DATE_FORMAT(start_date, '%Y-%m-%d'), '') AS startDate,
            CAST(billing_day AS CHAR) AS billingDay,
            CAST(due_after_days AS CHAR) AS dueAfterDays,
            COALESCE(DATE_FORMAT(last_sent_at, '%b %e, %Y, %h:%i %p'), 'Not sent yet') AS lastSent,
            COALESCE(DATE_FORMAT(last_sent_due_date, '%Y-%m-%d'), '') AS lastSentDueDate,
            status
         FROM monthly_invoice_clients
         WHERE company_id = 1
         ORDER BY id ASC"
    );
    $clientStatement->execute();
    $clients = array_map(function ($client) {
        $client['status'] = title_status($client['status']);
        return $client;
    }, $clientStatement->fetchAll());

    $paymentStatement = $pdo->prepare(
        "SELECT
            CONCAT('db-', id) AS id,
            LOWER(billing_email) AS clientId,
            CAST(amount AS CHAR) AS amount,
            DATE_FORMAT(payment_date, '%Y-%m-%d') AS paidAt,
            method,
            COALESCE(reference_number, '') AS referenceNumber,
            COALESCE(notes, '') AS notes,
            DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt
         FROM monthly_invoice_payments
         WHERE company_id = 1
         ORDER BY payment_date ASC, id ASC"
    );
    $paymentStatement->execute();

    return [
        'clients' => $clients,
        'payments' => $paymentStatement->fetchAll()
    ];
}

function upsert_client($pdo, $client) {
    ensure_company($pdo);

    $email = strtolower(clean_value($client['email'] ?? $client['id'] ?? ''));

    if ($email === '') {
        throw new RuntimeException('Client email is required.');
    }

    $statement = $pdo->prepare(
        "INSERT INTO monthly_invoice_clients (
            company_id,
            customer_name,
            billing_email,
            billing_address,
            invoice_number,
            monthly_amount,
            start_date,
            billing_day,
            due_after_days,
            last_sent_due_date,
            status,
            updated_at
         )
         VALUES (
            1,
            :customer_name,
            :billing_email,
            :billing_address,
            :invoice_number,
            :monthly_amount,
            :start_date,
            :billing_day,
            :due_after_days,
            :last_sent_due_date,
            :status,
            NOW()
         )
         ON DUPLICATE KEY UPDATE
            customer_name = VALUES(customer_name),
            billing_address = VALUES(billing_address),
            invoice_number = VALUES(invoice_number),
            monthly_amount = VALUES(monthly_amount),
            start_date = VALUES(start_date),
            billing_day = VALUES(billing_day),
            due_after_days = VALUES(due_after_days),
            last_sent_due_date = VALUES(last_sent_due_date),
            status = VALUES(status),
            updated_at = NOW()"
    );
    $statement->execute([
        ':customer_name' => clean_value($client['name'] ?? 'Unnamed customer') ?: 'Unnamed customer',
        ':billing_email' => $email,
        ':billing_address' => clean_value($client['address'] ?? ''),
        ':invoice_number' => clean_value($client['invoiceNumber'] ?? ''),
        ':monthly_amount' => decimal_value($client['amount'] ?? '0.00'),
        ':start_date' => date_or_null($client['startDate'] ?? null),
        ':billing_day' => int_value($client['billingDay'] ?? null, 1, 1, 31),
        ':due_after_days' => int_value($client['dueAfterDays'] ?? null, 14, 1, 90),
        ':last_sent_due_date' => date_or_null($client['lastSentDueDate'] ?? null),
        ':status' => db_status($client['status'] ?? 'Scheduled')
    ]);
}

function record_payment($pdo, $payment) {
    ensure_company($pdo);

    $email = strtolower(clean_value($payment['clientId'] ?? ''));

    if ($email === '') {
        throw new RuntimeException('Payment client email is required.');
    }

    $statement = $pdo->prepare(
        "INSERT INTO monthly_invoice_payments (
            company_id,
            client_id,
            billing_email,
            amount,
            payment_date,
            method,
            reference_number,
            notes
         )
         VALUES (
            1,
            (SELECT id FROM monthly_invoice_clients WHERE company_id = 1 AND billing_email = :client_lookup LIMIT 1),
            :billing_email,
            :amount,
            :payment_date,
            :method,
            :reference_number,
            :notes
         )"
    );
    $statement->execute([
        ':client_lookup' => $email,
        ':billing_email' => $email,
        ':amount' => decimal_value($payment['amount'] ?? '0.00'),
        ':payment_date' => date_or_null($payment['paidAt'] ?? null) ?: date('Y-m-d'),
        ':method' => clean_value($payment['method'] ?? 'Cash') ?: 'Cash',
        ':reference_number' => clean_value($payment['referenceNumber'] ?? '') ?: null,
        ':notes' => clean_value($payment['notes'] ?? '') ?: null
    ]);
}

function delete_client($pdo, $clientId) {
    $email = strtolower(clean_value($clientId));

    if ($email === '') {
        throw new RuntimeException('Client email is required.');
    }

    $paymentStatement = $pdo->prepare('DELETE FROM monthly_invoice_payments WHERE company_id = 1 AND billing_email = :billing_email');
    $paymentStatement->execute([':billing_email' => $email]);

    $clientStatement = $pdo->prepare('DELETE FROM monthly_invoice_clients WHERE company_id = 1 AND billing_email = :billing_email');
    $clientStatement->execute([':billing_email' => $email]);
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        json_response(200, array_merge(['success' => true], read_store($pdo)));
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_response(405, ['success' => false, 'error' => 'Method not allowed']);
    }

    $payload = json_decode(file_get_contents('php://input'), true) ?: [];
    $action = $payload['action'] ?? '';

    if ($action === 'upsert_client') {
        upsert_client($pdo, $payload['client'] ?? []);
    } elseif ($action === 'record_payment') {
        record_payment($pdo, $payload['payment'] ?? []);
    } elseif ($action === 'delete_client') {
        delete_client($pdo, $payload['client_id'] ?? '');
    } elseif ($action === 'sync') {
        foreach (($payload['clients'] ?? []) as $client) {
            upsert_client($pdo, $client);
        }

        $countStatement = $pdo->query('SELECT COUNT(*) AS payment_count FROM monthly_invoice_payments WHERE company_id = 1');
        $paymentCount = (int) (($countStatement->fetch()['payment_count'] ?? 0));

        if ($paymentCount === 0) {
            foreach (($payload['payments'] ?? []) as $payment) {
                record_payment($pdo, $payment);
            }
        }
    } else {
        json_response(422, ['success' => false, 'error' => 'Unknown monthly invoice action.']);
    }

    json_response(200, array_merge(['success' => true], read_store($pdo)));
} catch (Throwable $e) {
    json_response(500, [
        'success' => false,
        'error' => security_public_error($e)
    ]);
}
