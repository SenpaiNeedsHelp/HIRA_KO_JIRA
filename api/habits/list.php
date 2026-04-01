<?php
/**
 * List Habits API
 * GET /api/habits/list.php
 */

require_once '../config/database.php';

setCorsHeaders();

$database = new Database();
$db = $database->getConnection();

$user_id = verifySession($db);

try {
    // Get filter parameters
    $archived = isset($_GET['archived']) ? filter_var($_GET['archived'], FILTER_VALIDATE_BOOLEAN) : false;
    $category = isset($_GET['category']) ? $_GET['category'] : null;

    $query = "SELECT
                h.id,
                h.user_id,
                h.name,
                h.category,
                h.description,
                h.color,
                h.icon,
                h.is_archived,
                h.display_order,
                h.frequency,
                h.target_days,
                h.reminder_time,
                h.created_at,
                h.updated_at,
                (
                    SELECT COUNT(*)
                    FROM habit_completions hc
                    WHERE hc.habit_id = h.id AND hc.status = 'completed'
                ) as total_completions,
                (
                    SELECT COUNT(DISTINCT hc.completion_date)
                    FROM habit_completions hc
                    WHERE hc.habit_id = h.id
                        AND hc.status = 'completed'
                        AND hc.completion_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                ) as completions_last_30d,
                (
                    SELECT status
                    FROM habit_completions hc
                    WHERE hc.habit_id = h.id AND hc.completion_date = CURDATE()
                    LIMIT 1
                ) as today_status
              FROM habits h
              WHERE h.user_id = :user_id AND h.is_archived = :archived";

    if ($category && $category !== 'All') {
        $query .= " AND h.category = :category";
    }

    $query .= " ORDER BY h.display_order ASC, h.created_at DESC";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':user_id', $user_id);
    $stmt->bindParam(':archived', $archived, PDO::PARAM_BOOL);

    if ($category && $category !== 'All') {
        $stmt->bindParam(':category', $category);
    }

    $stmt->execute();
    $habits = $stmt->fetchAll();

    // Process habits
    foreach ($habits as &$habit) {
        $habit['today_status'] = $habit['today_status'] ?? 'pending';
        $habit['target_days'] = $habit['target_days'] ? json_decode($habit['target_days']) : null;
    }

    sendResponse([
        'success' => true,
        'habits' => $habits,
        'count' => count($habits)
    ]);

} catch (PDOException $e) {
    sendResponse([
        'success' => false,
        'message' => 'Failed to fetch habits: ' . $e->getMessage()
    ], 500);
}
?>
