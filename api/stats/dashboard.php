<?php
/**
 * Dashboard Statistics API
 * GET /api/stats/dashboard.php
 */

require_once '../config/database.php';

setCorsHeaders();

$database = new Database();
$db = $database->getConnection();

$user_id = verifySession($db);

try {
    $response = [];

    // Get user info
    $userQuery = "SELECT id, email, name, avatar, level, xp, current_streak, best_streak
                  FROM users WHERE id = :user_id";
    $userStmt = $db->prepare($userQuery);
    $userStmt->bindParam(':user_id', $user_id);
    $userStmt->execute();
    $response['user'] = $userStmt->fetch();

    // Get active habits count
    $activeHabitsQuery = "SELECT COUNT(*) as count FROM habits
                          WHERE user_id = :user_id AND is_archived = FALSE";
    $activeStmt = $db->prepare($activeHabitsQuery);
    $activeStmt->bindParam(':user_id', $user_id);
    $activeStmt->execute();
    $response['active_habits'] = $activeStmt->fetch()['count'];

    // Get total habits count
    $totalHabitsQuery = "SELECT COUNT(*) as count FROM habits WHERE user_id = :user_id";
    $totalStmt = $db->prepare($totalHabitsQuery);
    $totalStmt->bindParam(':user_id', $user_id);
    $totalStmt->execute();
    $response['total_habits'] = $totalStmt->fetch()['count'];

    // Get today's habits
    $todayQuery = "SELECT
                    h.id,
                    h.name,
                    h.category,
                    h.color,
                    h.icon,
                    COALESCE(hc.status, 'pending') as status,
                    hc.completed_at
                  FROM habits h
                  LEFT JOIN habit_completions hc ON h.id = hc.habit_id AND hc.completion_date = CURDATE()
                  WHERE h.user_id = :user_id AND h.is_archived = FALSE
                  ORDER BY h.display_order ASC";
    $todayStmt = $db->prepare($todayQuery);
    $todayStmt->bindParam(':user_id', $user_id);
    $todayStmt->execute();
    $response['today_habits'] = $todayStmt->fetchAll();

    // Calculate today's progress
    $todayCount = count($response['today_habits']);
    $todayCompleted = 0;
    foreach ($response['today_habits'] as $habit) {
        if ($habit['status'] === 'completed') {
            $todayCompleted++;
        }
    }
    $response['today_progress'] = [
        'total' => $todayCount,
        'completed' => $todayCompleted,
        'percentage' => $todayCount > 0 ? round(($todayCompleted / $todayCount) * 100) : 0
    ];

    // Get completion rate for last 30 days
    $completionRateQuery = "SELECT
                            COUNT(CASE WHEN hc.status = 'completed' THEN 1 END) as completed,
                            COUNT(*) as total
                          FROM habits h
                          LEFT JOIN habit_completions hc ON h.id = hc.habit_id
                          WHERE h.user_id = :user_id
                            AND h.is_archived = FALSE
                            AND hc.completion_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
    $rateStmt = $db->prepare($completionRateQuery);
    $rateStmt->bindParam(':user_id', $user_id);
    $rateStmt->execute();
    $rateData = $rateStmt->fetch();
    $response['completion_rate_30d'] = $rateData['total'] > 0
        ? round(($rateData['completed'] / $rateData['total']) * 100)
        : 0;

    // Get weekly overview (last 7 days)
    $weeklyQuery = "SELECT
                      DATE(hc.completion_date) as date,
                      COUNT(CASE WHEN hc.status = 'completed' THEN 1 END) as completed,
                      COUNT(*) as total
                    FROM habit_completions hc
                    INNER JOIN habits h ON hc.habit_id = h.id
                    WHERE h.user_id = :user_id
                      AND hc.completion_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                      AND hc.completion_date <= CURDATE()
                    GROUP BY DATE(hc.completion_date)
                    ORDER BY date ASC";
    $weeklyStmt = $db->prepare($weeklyQuery);
    $weeklyStmt->bindParam(':user_id', $user_id);
    $weeklyStmt->execute();
    $weeklyData = $weeklyStmt->fetchAll();

    // Fill in missing days with 0 values
    $response['weekly_overview'] = [];
    for ($i = 6; $i >= 0; $i--) {
        $date = date('Y-m-d', strtotime("-$i days"));
        $found = false;
        foreach ($weeklyData as $day) {
            if ($day['date'] === $date) {
                $response['weekly_overview'][] = [
                    'date' => $date,
                    'day' => date('D', strtotime($date)),
                    'completed' => (int)$day['completed'],
                    'total' => (int)$day['total'],
                    'percentage' => $day['total'] > 0 ? round(($day['completed'] / $day['total']) * 100) : 0
                ];
                $found = true;
                break;
            }
        }
        if (!$found) {
            $response['weekly_overview'][] = [
                'date' => $date,
                'day' => date('D', strtotime($date)),
                'completed' => 0,
                'total' => 0,
                'percentage' => 0
            ];
        }
    }

    // Get total completions
    $totalCompletionsQuery = "SELECT COUNT(*) as count FROM habit_completions hc
                              INNER JOIN habits h ON hc.habit_id = h.id
                              WHERE h.user_id = :user_id AND hc.status = 'completed'";
    $totalCompStmt = $db->prepare($totalCompletionsQuery);
    $totalCompStmt->bindParam(':user_id', $user_id);
    $totalCompStmt->execute();
    $response['total_completions'] = $totalCompStmt->fetch()['count'];

    sendResponse([
        'success' => true,
        'data' => $response
    ]);

} catch (PDOException $e) {
    sendResponse([
        'success' => false,
        'message' => 'Failed to fetch dashboard data: ' . $e->getMessage()
    ], 500);
}
?>
