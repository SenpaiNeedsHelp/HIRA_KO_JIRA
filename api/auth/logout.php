<?php
/**
 * Logout API
 * POST /api/auth/logout.php
 */

require_once '../utils/response.php';

setCorsHeaders();

// Validate POST request
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse([
        'success' => false,
        'message' => 'Invalid request method. POST required.'
    ], 405);
    exit;
}

// Start session only if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Clear session cookie
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly']
    );
}

// Unset all session variables
$_SESSION = [];

// Destroy session
session_destroy();

sendResponse([
    'success' => true,
    'message' => 'Logged out successfully'
]);