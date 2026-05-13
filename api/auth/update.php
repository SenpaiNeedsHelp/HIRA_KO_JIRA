<?php
/**
 * Update Profile API
 * POST /api/auth/update.php
 */

require_once '../config/database.php';

setCorsHeaders();

function normalizeBoolean($value) {
    return filter_var($value, FILTER_VALIDATE_BOOLEAN);
}

$database = new Database();
$db = $database->getConnection();

$data = getJsonInput();
$user_id = verifySession($db);

$updateUser = array_key_exists('name', $data) || array_key_exists('email', $data) || array_key_exists('password', $data) || array_key_exists('avatar', $data);
$updateSettings = array_key_exists('settings', $data);

if (!$updateUser && !$updateSettings) {
    sendResponse([
        'success' => false,
        'message' => 'Nothing to update.'
    ], 400);
}

$name = isset($data['name']) ? trim($data['name']) : null;
$email = isset($data['email']) ? trim($data['email']) : null;
$password = array_key_exists('password', $data) ? $data['password'] : null;
$avatar = array_key_exists('avatar', $data) ? $data['avatar'] : null;

if ($updateUser) {
    if (empty($name) || empty($email)) {
        sendResponse([
            'success' => false,
            'message' => 'Name and email are required.'
        ], 400);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendResponse([
            'success' => false,
            'message' => 'Invalid email format.'
        ], 400);
    }
}

try {
    if ($updateUser) {
        $checkQuery = "SELECT id FROM users WHERE email = :email AND id != :user_id";
        $checkStmt = $db->prepare($checkQuery);
        $checkStmt->bindParam(':email', $email);
        $checkStmt->bindParam(':user_id', $user_id);
        $checkStmt->execute();

        if ($checkStmt->rowCount() > 0) {
            sendResponse([
                'success' => false,
                'message' => 'Email is already in use by another account.'
            ], 409);
        }

        $fields = [
            'name = :name',
            'email = :email'
        ];
        if ($password) {
            $fields[] = 'password_hash = :password_hash';
            $password_hash = password_hash($password, PASSWORD_BCRYPT);
        }
        if ($avatar !== null) {
            $fields[] = 'avatar = :avatar';
        }

        $updateQuery = "UPDATE users SET " . implode(', ', $fields) . " WHERE id = :user_id";
        $updateStmt = $db->prepare($updateQuery);
        $updateStmt->bindParam(':name', $name);
        $updateStmt->bindParam(':email', $email);
        $updateStmt->bindParam(':user_id', $user_id);

        if ($password) {
            $updateStmt->bindParam(':password_hash', $password_hash);
        }
        if ($avatar !== null) {
            $updateStmt->bindParam(':avatar', $avatar);
        }

        $updateStmt->execute();
    }

    if ($updateSettings) {
        $settings = $data['settings'];
        $notificationsEnabled = isset($settings['notifications_enabled']) ? filter_var($settings['notifications_enabled'], FILTER_VALIDATE_BOOLEAN) : false;
        $weeklyReportEnabled = isset($settings['weekly_report_enabled']) ? filter_var($settings['weekly_report_enabled'], FILTER_VALIDATE_BOOLEAN) : false;
                $notificationTime = isset($settings['notification_time']) ? $settings['notification_time'] : '09:00:00';
        $timezone = isset($settings['timezone']) ? trim($settings['timezone']) : 'UTC';
        $theme = isset($settings['theme']) ? trim($settings['theme']) : 'auto';

                $settingsQuery = "INSERT INTO user_settings (user_id, theme, notifications_enabled, weekly_report_enabled, notification_time, timezone)
                                                    VALUES (:user_id, :theme, :notifications_enabled, :weekly_report_enabled, :notification_time, :timezone)
                          ON DUPLICATE KEY UPDATE
                            theme = VALUES(theme),
                            notifications_enabled = VALUES(notifications_enabled),
                            weekly_report_enabled = VALUES(weekly_report_enabled),
                                                        notification_time = VALUES(notification_time),
                            timezone = VALUES(timezone)";
        $settingsStmt = $db->prepare($settingsQuery);
        $settingsStmt->bindParam(':user_id', $user_id);
        $settingsStmt->bindParam(':theme', $theme);
        $settingsStmt->bindValue(':notifications_enabled', $notificationsEnabled, PDO::PARAM_BOOL);
        $settingsStmt->bindValue(':weekly_report_enabled', $weeklyReportEnabled, PDO::PARAM_BOOL);
        $settingsStmt->bindParam(':notification_time', $notificationTime);
        $settingsStmt->bindParam(':timezone', $timezone);
        $settingsStmt->execute();
    }

        $selectQuery = "SELECT u.id, u.email, u.name, u.avatar, u.level, u.xp, u.current_streak, u.best_streak, u.member_since,
                                                        s.theme, s.notifications_enabled, s.weekly_report_enabled, s.notification_time, s.timezone
                    FROM users u
                    LEFT JOIN user_settings s ON u.id = s.user_id
                    WHERE u.id = :user_id";
    $selectStmt = $db->prepare($selectQuery);
    $selectStmt->bindParam(':user_id', $user_id);
    $selectStmt->execute();
    $user = $selectStmt->fetch();

    $_SESSION['user_email'] = $user['email'];
    $_SESSION['user_name'] = $user['name'];

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
        'message' => 'Profile updated successfully.',
        'user' => $user
    ]);
} catch (PDOException $e) {
    sendResponse([
        'success' => false,
        'message' => 'Profile update failed: ' . $e->getMessage()
    ], 500);
}
?>