<?php
/**
 * User Login API
 * POST /api/auth/login.php
 */

require_once '../config/database.php';

setCorsHeaders();
session_start();

$db = (new Database())->getConnection();
$data = getJsonInput();

// Validate input safely
$email = trim($data['email'] ?? '');
$password = $data['password'] ?? '';

if (!$email || !$password) {
    sendResponse([
        'success' => false,
        'message' => 'Email and password are required'
    ], 400);
}

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendResponse([
        'success' => false,
        'message' => 'Invalid email format'
    ], 400);
}

try {
    // Fetch user
    $query = "SELECT id, email, password_hash, name, avatar, level, xp, current_streak, best_streak
              FROM users
              WHERE email = :email AND is_active = TRUE
              LIMIT 1";

    $stmt = $db->prepare($query);
    $stmt->execute(['email' => $email]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // Check user exists first, then verify password
    if (!$user) {
        sendResponse([
            'success' => false,
            'message' => 'Invalid email or password'
        ], 401);
    }

    if (!password_verify($password, $user['password_hash'])) {
        sendResponse([
            'success' => false,
            'message' => 'Invalid email or password'
        ], 401);
    }

    // Update last login
    $updateStmt = $db->prepare("UPDATE users SET last_login = NOW() WHERE id = :id");
    $updateStmt->execute(['id' => $user['id']]);

    // Regenerate session ID to prevent session fixation
    session_regenerate_id(true);

    // Start session
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['user_name'] = $user['name'];

    // Remove sensitive data
    unset($user['password_hash']);

    sendResponse([
        'success' => true,
        'message' => 'Login successful',
        'user' => $user
    ]);

} catch (PDOException $e) {
    error_log('Login error: ' . $e->getMessage());
    sendResponse([
        'success' => false,
        'message' => 'Server error'
    ], 500);
}