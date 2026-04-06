<?php
/**
 * Delete Habit API
 * POST /api/habits/delete.php
 */

require_once '../config/database.php';

setCorsHeaders();

$database = new Database();
$db = $database->getConnection();

$user_id = verifySession($db);
$data = getJsonInput();

if (empty($data['id'])) {
    sendResponse([
        'success' => false,
        'message' => 'Habit ID is required'
    ], 400);
}

$habit_id = (int) $data['id'];

try {
    $db->beginTransaction();

    // Ensure the habit belongs to the authenticated user.
    $ownerQuery = "SELECT id FROM habits WHERE id = :id AND user_id = :user_id LIMIT 1";
    $ownerStmt = $db->prepare($ownerQuery);
    $ownerStmt->bindParam(':id', $habit_id, PDO::PARAM_INT);
    $ownerStmt->bindParam(':user_id', $user_id, PDO::PARAM_INT);
    $ownerStmt->execute();

    if (!$ownerStmt->fetch()) {
        $db->rollBack();
        sendResponse([
            'success' => false,
            'message' => 'Habit not found'
        ], 404);
    }

    // Remove completion history first in case FK is not cascade.
    $deleteCompletionsQuery = "DELETE FROM habit_completions WHERE habit_id = :habit_id";
    $deleteCompletionsStmt = $db->prepare($deleteCompletionsQuery);
    $deleteCompletionsStmt->bindParam(':habit_id', $habit_id, PDO::PARAM_INT);
    $deleteCompletionsStmt->execute();

    $deleteHabitQuery = "DELETE FROM habits WHERE id = :id AND user_id = :user_id";
    $deleteHabitStmt = $db->prepare($deleteHabitQuery);
    $deleteHabitStmt->bindParam(':id', $habit_id, PDO::PARAM_INT);
    $deleteHabitStmt->bindParam(':user_id', $user_id, PDO::PARAM_INT);
    $deleteHabitStmt->execute();

    $db->commit();

    sendResponse([
        'success' => true,
        'message' => 'Habit deleted successfully'
    ]);
} catch (PDOException $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }

    sendResponse([
        'success' => false,
        'message' => 'Failed to delete habit: ' . $e->getMessage()
    ], 500);
}
?>
