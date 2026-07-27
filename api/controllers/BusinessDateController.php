<?php

final class BusinessDateController {
    private PDO $pdo;
    private int $companyId;

    public function __construct(PDO $pdo, int $companyId = 1) {
        $this->pdo = $pdo;
        $this->companyId = $companyId;
    }

    public function show(): array {
        $statement = $this->pdo->prepare(
            "SELECT DATE_FORMAT(business_date, '%Y-%m-%d') AS business_date, source, updated_at
             FROM business_dates
             WHERE company_id = :company_id"
        );
        $statement->execute([':company_id' => $this->companyId]);
        $row = $statement->fetch();

        return $row ?: $this->set(date('Y-m-d'), 'automatic');
    }

    public function sync(): array {
        return $this->set(date('Y-m-d'), 'cron');
    }

    public function setManual(string $businessDate): array {
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $businessDate);

        if (!$parsed || $parsed->format('Y-m-d') !== $businessDate) {
            throw new InvalidArgumentException('Business date must use YYYY-MM-DD format.');
        }

        return $this->set($businessDate, 'manual');
    }

    private function set(string $businessDate, string $source): array {
        $company = $this->pdo->prepare(
            "INSERT INTO companies (id, name, tenant_key)
             VALUES (:company_id, 'Visual Security Systems', 'visual-security-systems')
             ON DUPLICATE KEY UPDATE name = VALUES(name)"
        );
        $company->execute([':company_id' => $this->companyId]);

        $statement = $this->pdo->prepare(
            'INSERT INTO business_dates (company_id, business_date, source)
             VALUES (:company_id, :business_date, :source)
             ON DUPLICATE KEY UPDATE business_date = VALUES(business_date), source = VALUES(source), updated_at = CURRENT_TIMESTAMP'
        );
        $statement->execute([
            ':company_id' => $this->companyId,
            ':business_date' => $businessDate,
            ':source' => $source,
        ]);
        return $this->show();
    }
}
