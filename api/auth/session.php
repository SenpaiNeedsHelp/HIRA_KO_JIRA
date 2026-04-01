<?php
/**
 * Check Session API
 * GET /api/auth/session.php
 */

require_once '../config/database.php';

setCorsHeaders();

session_start();

if (isset($_SESSION['user_id'])) {
    $database = new Database();
    $db = $database->getConnection();

    try {
        $query = "SELECT id, email, name, avatar, level, xp, current_streak, best_streak
                  FROM users WHERE id = :user_id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':user_id', $_SESSION['user_id']);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            $user = $stmt->fetch();
            sendResponse([
                'success' => true,
                'authenticated' => true,
                'user' => $user
            ]);
        }
    } catch (PDOException $e) {
        sendResponse([
            'success' => false,
            'authenticated' => false,
            'message' => $e->getMessage()
        ], 500);
    }
}

sendResponse([
    'success' => true,
    'authenticated' => false
]);
?>
