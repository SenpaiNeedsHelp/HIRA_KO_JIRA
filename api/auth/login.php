<?php
/**
 * User Login API
 * POST /api/auth/login.php
 */

require_once '../config/database.php';

setCorsHeaders();

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
    $query = "SELECT id, email, password_hash, name, avatar, level, xp, current_streak, best_streak
              FROM users
              WHERE email = :email AND is_active = TRUE";

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
