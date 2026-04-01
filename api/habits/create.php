<?php
/**
 * Create Habit API
 * POST /api/habits/create.php
 */

require_once '../config/database.php';

setCorsHeaders();

$database = new Database();
$db = $database->getConnection();

$user_id = verifySession($db);

$data = getJsonInput();

// Validate input
if (empty($data['name'])) {
    sendResponse([
        'success' => false,
        'message' => 'Habit name is required'
    ], 400);
}

$name = trim($data['name']);
$category = $data['category'] ?? 'Other';
$description = $data['description'] ?? null;
$color = $data['color'] ?? '#4CAF50';
$icon = $data['icon'] ?? '⭐';
$frequency = $data['frequency'] ?? 'daily';
$target_days = isset($data['target_days']) ? json_encode($data['target_days']) : null;
$reminder_time = $data['reminder_time'] ?? null;

try {
    // Get max display order
    $orderQuery = "SELECT MAX(display_order) as max_order FROM habits WHERE user_id = :user_id";
    $orderStmt = $db->prepare($orderQuery);
    $orderStmt->bindParam(':user_id', $user_id);
    $orderStmt->execute();
    $maxOrder = $orderStmt->fetch()['max_order'] ?? 0;
    $displayOrder = $maxOrder + 1;

    // Insert habit
    $insertQuery = "INSERT INTO habits
                    (user_id, name, category, description, color, icon, display_order, frequency, target_days, reminder_time)
                    VALUES
                    (:user_id, :name, :category, :description, :color, :icon, :display_order, :frequency, :target_days, :reminder_time)";

    $stmt = $db->prepare($insertQuery);
    $stmt->bindParam(':user_id', $user_id);
    $stmt->bindParam(':name', $name);
    $stmt->bindParam(':category', $category);
    $stmt->bindParam(':description', $description);
    $stmt->bindParam(':color', $color);
    $stmt->bindParam(':icon', $icon);
    $stmt->bindParam(':display_order', $displayOrder);
    $stmt->bindParam(':frequency', $frequency);
    $stmt->bindParam(':target_days', $target_days);
    $stmt->bindParam(':reminder_time', $reminder_time);
    $stmt->execute();

    $habit_id = $db->lastInsertId();

    // Get the created habit
    $getQuery = "SELECT * FROM habits WHERE id = :id";
    $getStmt = $db->prepare($getQuery);
    $getStmt->bindParam(':id', $habit_id);
    $getStmt->execute();
    $habit = $getStmt->fetch();

    sendResponse([
        'success' => true,
        'message' => 'Habit created successfully',
        'habit' => $habit
    ]);

} catch (PDOException $e) {
    sendResponse([
        'success' => false,
        'message' => 'Failed to create habit: ' . $e->getMessage()
    ], 500);
}
?>
