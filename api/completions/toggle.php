<?php
/**
 * Toggle Habit Completion API
 * POST /api/completions/toggle.php
 */

require_once '../config/database.php';

setCorsHeaders();

$database = new Database();
$db = $database->getConnection();

$user_id = verifySession($db);

$data = getJsonInput();

// Validate input
if (empty($data['habit_id']) || empty($data['date'])) {
    sendResponse([
        'success' => false,
        'message' => 'Habit ID and date are required'
    ], 400);
}

$habit_id = $data['habit_id'];
$date = $data['date'];
$status = $data['status'] ?? 'completed'; // completed, missed, or pending

try {
    // Verify habit belongs to user
    $verifyQuery = "SELECT id FROM habits WHERE id = :habit_id AND user_id = :user_id";
    $verifyStmt = $db->prepare($verifyQuery);
    $verifyStmt->bindParam(':habit_id', $habit_id);
    $verifyStmt->bindParam(':user_id', $user_id);
    $verifyStmt->execute();

    if ($verifyStmt->rowCount() === 0) {
        sendResponse([
            'success' => false,
            'message' => 'Habit not found'
        ], 404);
    }

    // Check if completion already exists
    $checkQuery = "SELECT id, status FROM habit_completions
                   WHERE habit_id = :habit_id AND completion_date = :date";
    $checkStmt = $db->prepare($checkQuery);
    $checkStmt->bindParam(':habit_id', $habit_id);
    $checkStmt->bindParam(':date', $date);
    $checkStmt->execute();

    if ($checkStmt->rowCount() > 0) {
        // Update existing completion
        $existing = $checkStmt->fetch();

        if ($status === 'pending') {
            // Delete the completion entry
            $deleteQuery = "DELETE FROM habit_completions WHERE id = :id";
            $deleteStmt = $db->prepare($deleteQuery);
            $deleteStmt->bindParam(':id', $existing['id']);
            $deleteStmt->execute();

            sendResponse([
                'success' => true,
                'message' => 'Completion removed',
                'status' => 'pending'
            ]);
        } else {
            // Update status
            $completed_at = ($status === 'completed') ? date('Y-m-d H:i:s') : null;

            $updateQuery = "UPDATE habit_completions
                           SET status = :status, completed_at = :completed_at
                           WHERE id = :id";
            $updateStmt = $db->prepare($updateQuery);
            $updateStmt->bindParam(':status', $status);
            $updateStmt->bindParam(':completed_at', $completed_at);
            $updateStmt->bindParam(':id', $existing['id']);
            $updateStmt->execute();

            sendResponse([
                'success' => true,
                'message' => 'Completion updated',
                'status' => $status
            ]);
        }
    } else {
        // Insert new completion
        if ($status === 'pending') {
            sendResponse([
                'success' => true,
                'message' => 'Already pending',
                'status' => 'pending'
            ]);
        }

        $completed_at = ($status === 'completed') ? date('Y-m-d H:i:s') : null;

        $insertQuery = "INSERT INTO habit_completions
                       (habit_id, completion_date, status, completed_at)
                       VALUES (:habit_id, :date, :status, :completed_at)";
        $insertStmt = $db->prepare($insertQuery);
        $insertStmt->bindParam(':habit_id', $habit_id);
        $insertStmt->bindParam(':date', $date);
        $insertStmt->bindParam(':status', $status);
        $insertStmt->bindParam(':completed_at', $completed_at);
        $insertStmt->execute();

        sendResponse([
            'success' => true,
            'message' => 'Completion recorded',
            'status' => $status
        ]);
    }

} catch (PDOException $e) {
    sendResponse([
        'success' => false,
        'message' => 'Failed to toggle completion: ' . $e->getMessage()
    ], 500);
}
?>
