<?php
require_once '../config/database.php';
require_once '../utils/response.php';

setCorsHeaders();

$db = (new Database())->getConnection();

$token = $_GET['token'] ?? '';

if (!$token) {
    sendResponse(['success' => false, 'message' => 'Invalid token'], 400);
}

$stmt = $db->prepare("SELECT id FROM users WHERE verification_token = :token");
$stmt->execute(['token' => $token]);

$user = $stmt->fetch();

if (!$user) {
    sendResponse(['success' => false, 'message' => 'Invalid token'], 400);
}

// Verify user
$update = $db->prepare("
    UPDATE users 
    SET is_verified = 1, verification_token = NULL 
    WHERE id = :id
");

$update->execute(['id' => $user['id']]);

sendResponse(['success' => true, 'message' => 'Email verified']);