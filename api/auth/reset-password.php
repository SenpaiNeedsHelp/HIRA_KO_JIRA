<?php
require_once '../config/database.php';

setCorsHeaders();
$db = (new Database())->getConnection();
ensurePasswordResetColumns($db);

$data = getJsonInput();
$email = trim($data['email'] ?? '');
$otp = trim($data['otp'] ?? '');
$password = $data['password'] ?? '';

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendResponse(['success' => false, 'message' => 'Valid email is required'], 400);
}

if (!$otp || !preg_match('/^[0-9]{6}$/', $otp)) {
    sendResponse(['success' => false, 'message' => 'Valid OTP code is required'], 400);
}

if (!$password || strlen($password) < 6) {
    sendResponse(['success' => false, 'message' => 'Password must be at least 6 characters'], 400);
}

try {
    $stmt = $db->prepare('SELECT id, password_reset_code, password_reset_expires_at FROM users WHERE email = :email AND is_active = TRUE LIMIT 1');
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || empty($user['password_reset_code']) || $user['password_reset_code'] !== $otp) {
        sendResponse(['success' => false, 'message' => 'Invalid OTP or email'], 400);
    }

    $expiresAt = $user['password_reset_expires_at'] ? new DateTime($user['password_reset_expires_at'], new DateTimeZone('UTC')) : null;
    $now = new DateTime('now', new DateTimeZone('UTC'));

    if (!$expiresAt || $expiresAt < $now) {
        sendResponse(['success' => false, 'message' => 'OTP expired. Request a new one.'], 400);
    }

    $passwordHash = password_hash($password, PASSWORD_BCRYPT);
    $update = $db->prepare('UPDATE users SET password_hash = :password_hash, password_reset_code = NULL, password_reset_expires_at = NULL, password_reset_request_time = NULL, password_reset_resend_count = 0 WHERE id = :id');
    $update->execute([
        ':password_hash' => $passwordHash,
        ':id' => $user['id']
    ]);

    sendResponse(['success' => true, 'message' => 'Password reset successfully']);
} catch (PDOException $e) {
    sendResponse(['success' => false, 'message' => 'Server error'], 500);
}
