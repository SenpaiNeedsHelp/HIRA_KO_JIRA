<?php
/**
 * User Login API
 * POST /api/auth/login.php
 */

require_once '../config/database.php';

setCorsHeaders();

function normalizeBoolean($value) {
    return filter_var($value, FILTER_VALIDATE_BOOLEAN);
}

$database = new Database();
$db = $database->getConnection();

$data = getJsonInput();

// Validate input
if (empty($data['email']) || empty($data['password'])) {
    sendResponse([
        'success' => false,
        'message' => 'Email and password are required'
    ], 400);
}

$email = $data['email'];
$password = $data['password'];

try {
    // Get user by email
    $query = "SELECT u.id, u.email, u.password_hash, u.name, u.avatar, u.level, u.xp, u.current_streak, u.best_streak, u.member_since,
                     s.theme, s.notifications_enabled, s.weekly_report_enabled, s.notification_time, s.weekly_report_time, s.timezone
              FROM users u
              LEFT JOIN user_settings s ON u.id = s.user_id
              WHERE u.email = :email AND u.is_active = TRUE";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':email', $email);
    $stmt->execute();

    if ($stmt->rowCount() === 0) {
        sendResponse([
            'success' => false,
            'message' => 'Invalid email or password'
        ], 401);
    }

    $user = $stmt->fetch();

    // Verify password
    if (!password_verify($password, $user['password_hash'])) {
        sendResponse([
            'success' => false,
            'message' => 'Invalid email or password'
        ], 401);
    }

    // Update last login
    $updateQuery = "UPDATE users SET last_login = NOW() WHERE id = :id";
    $updateStmt = $db->prepare($updateQuery);
    $updateStmt->bindParam(':id', $user['id']);
    $updateStmt->execute();

    // Start session
    session_start();
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['user_name'] = $user['name'];

    // Remove password hash from response
    unset($user['password_hash']);

    $settings = [
        'theme' => $user['theme'] ?? 'auto',
        'notifications_enabled' => normalizeBoolean($user['notifications_enabled'] ?? false),
        'weekly_report_enabled' => normalizeBoolean($user['weekly_report_enabled'] ?? false),
        'notification_time' => $user['notification_time'] ?? '09:00:00',
        'weekly_report_time' => $user['weekly_report_time'] ?? '09:00:00',
        'timezone' => $user['timezone'] ?? 'UTC'
    ];

    unset($user['theme'], $user['notifications_enabled'], $user['weekly_report_enabled'], $user['notification_time'], $user['weekly_report_time'], $user['timezone']);
    $user['settings'] = $settings;

    sendResponse([
        'success' => true,
        'message' => 'Login successful',
        'user' => $user
    ]);

} catch (PDOException $e) {
    sendResponse([
        'success' => false,
        'message' => 'Login failed: ' . $e->getMessage()
    ], 500);
}
?>
