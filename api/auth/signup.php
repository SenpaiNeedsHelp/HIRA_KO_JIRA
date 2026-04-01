<?php
/**
 * User Registration API
 * POST /api/auth/signup.php
 */

require_once '../config/database.php';

setCorsHeaders();

$database = new Database();
$db = $database->getConnection();

$data = getJsonInput();

// Validate input
if (empty($data['email']) || empty($data['password']) || empty($data['name'])) {
    sendResponse([
        'success' => false,
        'message' => 'Email, password, and name are required'
    ], 400);
}

$email = trim($data['email']);
$password = $data['password'];
$name = trim($data['name']);

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendResponse([
        'success' => false,
        'message' => 'Invalid email format'
    ], 400);
}

// Validate password length
if (strlen($password) < 6) {
    sendResponse([
        'success' => false,
        'message' => 'Password must be at least 6 characters'
    ], 400);
}

try {
    // Check if email already exists
    $checkQuery = "SELECT id FROM users WHERE email = :email";
    $checkStmt = $db->prepare($checkQuery);
    $checkStmt->bindParam(':email', $email);
    $checkStmt->execute();

    if ($checkStmt->rowCount() > 0) {
        sendResponse([
            'success' => false,
            'message' => 'Email already registered'
        ], 409);
    }

    // Hash password
    $password_hash = password_hash($password, PASSWORD_BCRYPT);

    // Insert new user
    $insertQuery = "INSERT INTO users (email, password_hash, name, level, xp, current_streak, best_streak)
                    VALUES (:email, :password_hash, :name, 1, 0, 0, 0)";

    $insertStmt = $db->prepare($insertQuery);
    $insertStmt->bindParam(':email', $email);
    $insertStmt->bindParam(':password_hash', $password_hash);
    $insertStmt->bindParam(':name', $name);
    $insertStmt->execute();

    $user_id = $db->lastInsertId();

    // Create default settings
    $settingsQuery = "INSERT INTO user_settings (user_id, theme, notifications_enabled, weekly_report_enabled)
                      VALUES (:user_id, 'auto', FALSE, FALSE)";
    $settingsStmt = $db->prepare($settingsQuery);
    $settingsStmt->bindParam(':user_id', $user_id);
    $settingsStmt->execute();

    // Start session
    session_start();
    $_SESSION['user_id'] = $user_id;
    $_SESSION['user_email'] = $email;
    $_SESSION['user_name'] = $name;

    sendResponse([
        'success' => true,
        'message' => 'Registration successful',
        'user' => [
            'id' => $user_id,
            'email' => $email,
            'name' => $name,
            'level' => 1,
            'xp' => 0,
            'current_streak' => 0,
            'best_streak' => 0
        ]
    ]);

} catch (PDOException $e) {
    sendResponse([
        'success' => false,
        'message' => 'Registration failed: ' . $e->getMessage()
    ], 500);
}
?>
