<?php
require_once '../config/database.php';

setCorsHeaders();

function generateVerificationToken() {
    return bin2hex(random_bytes(32));
}

$db = (new Database())->getConnection();
$data = getJsonInput();

// Validation
if (empty($data['email']) || empty($data['password']) || empty($data['name'])) {
    sendResponse(['success' => false, 'message' => 'All fields required'], 400);
}

$email = trim($data['email']);
$password = $data['password'];
$name = trim($data['name']);

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendResponse(['success' => false, 'message' => 'Invalid email'], 400);
}

if (strlen($password) < 6) {
    sendResponse(['success' => false, 'message' => 'Password too short'], 400);
}

try {
    // Duplicate email check
    $stmt = $db->prepare("SELECT id FROM users WHERE email = :email");
    $stmt->execute(['email' => $email]);

    if ($stmt->fetch()) {
        sendResponse(['success' => false, 'message' => 'Email already exists'], 409);
    }

    $password_hash = password_hash($password, PASSWORD_BCRYPT);

    // Insert user
    $stmt = $db->prepare("
        INSERT INTO users (email, password_hash, name)
        VALUES (:email, :password, :name)
    ");

    $stmt->execute([
        ':email' => $email,
        ':password' => $password_hash,
        ':name' => $name
    ]);

    $user_id = $db->lastInsertId();

    // Create default settings
    $settingsStmt = $db->prepare("INSERT INTO user_settings (user_id, theme, notifications_enabled, weekly_report_enabled)
                                  VALUES (:user_id, 'auto', FALSE, FALSE)");
    $settingsStmt->bindParam(':user_id', $user_id);
    $settingsStmt->execute();

    sendResponse([
        'success' => true,
        'message' => 'Registered successfully.'
    ], 201);

} catch (PDOException $e) {
    sendResponse(['success' => false, 'message' => 'Server error'], 500);
}