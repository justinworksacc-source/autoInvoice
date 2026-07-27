<?php

require_once __DIR__ . '/BusinessDateController.php';

final class SettingsController {
    private BusinessDateController $businessDateController;

    public function __construct(PDO $pdo, private string $timezone = 'Asia/Manila', int $companyId = 1) {
        $this->businessDateController = new BusinessDateController($pdo, $companyId);
    }

    public function show(): array {
        return [
            'business_date' => $this->businessDateController->show(),
            'timezone' => $this->timezone,
            'automatic_sync' => true,
        ];
    }

    public function update(array $settings): array {
        $date = (string) ($settings['business_date'] ?? '');
        $this->businessDateController->setManual($date);

        return $this->show();
    }
}
