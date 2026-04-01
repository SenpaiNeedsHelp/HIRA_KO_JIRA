<?php
require_once '../config/database.php';
require_once '../utils/response.php';
require_once '../utils/helpers.php';

setCorsHeaders();

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
    $token = generateVerificationToken();

    // Insert user (NOT verified)
    $stmt = $db->prepare("
        INSERT INTO users (email, password_hash, name, is_verified, verification_token)
        VALUES (:email, :password, :name, 0, :token)
    ");

    $stmt->execute([
        ':email' => $email,
        ':password' => $password_hash,
        ':name' => $name,
        ':token' => $token
    ]);

    // 👉 Normally send email here (skipped)
    // Example verification link:
    // http://localhost/api/auth/verify-email.php?token=XXXX

    sendResponse([
        'success' => true,
        'message' => 'Registered. Please verify your email.',
        'verification_token' => $token // remove in production
    ], 201);

} catch (PDOException $e) {
    sendResponse(['success' => false, 'message' => 'Server error'], 500);
}