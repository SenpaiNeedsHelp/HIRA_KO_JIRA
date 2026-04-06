<?php
require_once '../config/database.php';

setCorsHeaders();
session_start();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    sendResponse([
        'success' => false,
        'authenticated' => false,
        'message' => 'Not authenticated'
    ], 401);
}

sendResponse([
    'success' => true,
    'authenticated' => true,
    'user' => [
        'id' => $_SESSION['user_id'],
        'email' => $_SESSION['user_email'] ?? null,
        'name' => $_SESSION['user_name'] ?? null
    ]
]);
