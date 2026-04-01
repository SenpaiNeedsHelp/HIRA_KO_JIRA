<?php
/**
 * Logout API
 * POST /api/auth/logout.php
 */

require_once '../config/database.php';

setCorsHeaders();

session_start();
session_destroy();

sendResponse([
    'success' => true,
    'message' => 'Logged out successfully'
]);
?>
