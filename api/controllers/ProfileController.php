<?php

final class ProfileController {
    public function __construct(private PDO $pdo, private int $companyId = 1) {}

    public function show(): array {
        $statement = $this->pdo->prepare(
            "SELECT c.name AS company_name, COALESCE(p.gmail_alias, 'billing@yourcompany.com') AS gmail_alias
             FROM companies c LEFT JOIN business_profiles p ON p.company_id = c.id WHERE c.id = :company_id"
        );
        $statement->execute([':company_id' => $this->companyId]);
        $profile = $statement->fetch() ?: [];

        return $profile;
    }

    public function update(array $profile): array {
        $companyName = trim((string) ($profile['company_name'] ?? ''));
        $gmailAlias = strtolower(trim((string) ($profile['gmail_alias'] ?? '')));

        if ($companyName === '') {
            throw new InvalidArgumentException('Company name is required.');
        }

        if (!filter_var($gmailAlias, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('A valid Gmail sender address is required.');
        }

        $this->pdo->beginTransaction();
        try {
            $company = $this->pdo->prepare('UPDATE companies SET name = :company_name WHERE id = :company_id');
            $company->execute([':company_name' => $companyName, ':company_id' => $this->companyId]);
            $profileStatement = $this->pdo->prepare(
                'INSERT INTO business_profiles (company_id, gmail_alias) VALUES (:company_id, :gmail_alias)
                 ON DUPLICATE KEY UPDATE gmail_alias = VALUES(gmail_alias), updated_at = CURRENT_TIMESTAMP'
            );
            $profileStatement->execute([':company_id' => $this->companyId, ':gmail_alias' => $gmailAlias]);
            $this->pdo->commit();
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }

        return $this->show();
    }
}
