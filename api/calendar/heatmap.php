<?php
/**
 * Calendar Heat Map Data API
 * GET /api/calendar/heatmap.php
 */

require_once '../config/database.php';

setCorsHeaders();

$database = new Database();
$db = $database->getConnection();

// Allow user_id parameter for testing (temporary)
$user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : verifySession($db);

// If user_id is provided via GET, skip session verification
if (!isset($_GET['user_id'])) {
    $user_id = verifySession($db);
}

try {
    // Get last 90 days of completion data for the current user
    $query = "SELECT
                DATE(hc.completion_date) as date,
                hc.status,
                COUNT(*) as count
              FROM habit_completions hc
              INNER JOIN habits h ON hc.habit_id = h.id
              WHERE h.user_id = :user_id
                AND hc.completion_date >= DATE_SUB(CURDATE(), INTERVAL 89 DAY)
                AND hc.completion_date <= CURDATE()
              GROUP BY DATE(hc.completion_date), hc.status
              ORDER BY date ASC";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':user_id', $user_id);
    $stmt->execute();

    $completions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Group by date
    $data = [];
    foreach ($completions as $completion) {
        $date = $completion['date'];
        if (!isset($data[$date])) {
            $data[$date] = [
                'completed' => 0,
                'missed' => 0,
                'pending' => 0
            ];
        }
        $data[$date][$completion['status']] = $completion['count'];
    }

    sendResponse([
        'success' => true,
        'data' => $data
    ]);

} catch (PDOException $e) {
    sendResponse([
        'success' => false,
        'message' => 'Failed to fetch heatmap data: ' . $e->getMessage()
    ], 500);
}
?>