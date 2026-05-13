<?php
require_once '../config/database.php';

setCorsHeaders();
session_start();
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}


function normalizeBoolean($value) {
    return filter_var($value, FILTER_VALIDATE_BOOLEAN);
}

if (!isset($_SESSION['user_id'])) {
    sendResponse([
        'success' => false,
        'authenticated' => false,
        'message' => 'Not authenticated'
    ], 401);
}

$database = new Database();
$db = $database->getConnection();

try {
    $query = "SELECT u.id, u.email, u.name, u.avatar, u.level, u.xp, u.current_streak, u.best_streak, u.member_since,
                     s.theme, s.notifications_enabled, s.weekly_report_enabled, s.notification_time, s.timezone
              FROM users u
              LEFT JOIN user_settings s ON u.id = s.user_id
              WHERE u.id = :user_id";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':user_id', $_SESSION['user_id']);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        $user = $stmt->fetch();
        $settings = [
            'theme' => $user['theme'] ?? 'auto',
            'notifications_enabled' => normalizeBoolean($user['notifications_enabled'] ?? false),
            'weekly_report_enabled' => normalizeBoolean($user['weekly_report_enabled'] ?? false),
            'notification_time' => $user['notification_time'] ?? '09:00:00',
            'timezone' => $user['timezone'] ?? 'UTC'
        ];

        unset($user['theme'], $user['notifications_enabled'], $user['weekly_report_enabled'], $user['notification_time'], $user['timezone']);
        $user['settings'] = $settings;

        sendResponse([
            'success' => true,
            'authenticated' => true,
            'user' => $user
        ]);
    }
} catch (PDOException $e) {
    sendResponse([
        'success' => false,
        'authenticated' => false,
        'message' => $e->getMessage()
    ], 500);
}

sendResponse([
    'success' => false,
    'authenticated' => false,
    'message' => 'Not authenticated'
], 401);
