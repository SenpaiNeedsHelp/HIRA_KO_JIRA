<?php
// Script to insert habit completions for the last 30 days
$host = 'localhost';
$dbname = 'habit_tracker';
$username = 'root';
$password = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Get all active habits for each user
    $habits = [
        // User 12 (John Doe) - habit IDs and completion rates
        ['habit_id' => 5, 'rate' => 90],  // Morning Exercise
        ['habit_id' => 6, 'rate' => 85],  // Read
        ['habit_id' => 7, 'rate' => 95],  // Water
        ['habit_id' => 8, 'rate' => 70],  // Meditate
        ['habit_id' => 9, 'rate' => 80],  // Coding
        ['habit_id' => 10, 'rate' => 75],  // Journal
        ['habit_id' => 11, 'rate' => 65],  // No social media

        // User 13 (Jane Smith)
        ['habit_id' => 13, 'rate' => 70],   // Morning yoga
        ['habit_id' => 14, 'rate' => 80],  // Breakfast
        ['habit_id' => 15, 'rate' => 60],  // Steps
        ['habit_id' => 16, 'rate' => 85],  // Skincare
        ['habit_id' => 17, 'rate' => 65],  // Study

        // User 14 (Mike Johnson) - very consistent
        ['habit_id' => 18, 'rate' => 95],  // Wake up 5am
        ['habit_id' => 19, 'rate' => 90],  // Cold shower
        ['habit_id' => 20, 'rate' => 95],  // Gym
        ['habit_id' => 21, 'rate' => 85],  // Meal prep
        ['habit_id' => 22, 'rate' => 80],  // Read business
        ['habit_id' => 23, 'rate' => 75],  // Network
        ['habit_id' => 24, 'rate' => 90],  // Plan tomorrow

        // User 15 (Sarah Wilson) - moderate
        ['habit_id' => 25, 'rate' => 60],  // Stretching
        ['habit_id' => 26, 'rate' => 70],  // Gratitude
        ['habit_id' => 27, 'rate' => 80],  // No caffeine
        ['habit_id' => 28, 'rate' => 55],  // Photography

        // User 16 (Demo User) - good for last 15 days
        ['habit_id' => 29, 'rate' => 85],  // Morning jog
        ['habit_id' => 30, 'rate' => 90],  // Breakfast
        ['habit_id' => 31, 'rate' => 85],  // Code review
        ['habit_id' => 32, 'rate' => 80],  // Tech articles
        ['habit_id' => 33, 'rate' => 75],  // Evening walk
        ['habit_id' => 34, 'rate' => 70],  // No screen
    ];

    $inserted = 0;

    // Insert completions for last 30 days
    for ($days_ago = 0; $days_ago < 30; $days_ago++) {
        $date = date('Y-m-d', strtotime("-$days_ago days"));

        foreach ($habits as $habit) {
            $random = rand(1, 100);
            $status = null;
            $completed_at = null;

            // For demo user (habits 29-34), ensure consistent completion for last 15 days
            if ($habit['habit_id'] >= 29 && $habit['habit_id'] <= 34 && $days_ago < 15) {
                if ($habit['habit_id'] <= 31) {  // First 3 habits always complete
                    $status = 'completed';
                    $hour = rand(6, 9);
                    $minute = rand(0, 59);
                    $completed_at = "$date " . sprintf("%02d:%02d:00", $hour, $minute);
                } else {
                    $random = rand(1, 100);
                    if ($random <= $habit['rate']) {
                        $status = 'completed';
                        $hour = rand(10, 22);
                        $minute = rand(0, 59);
                        $completed_at = "$date " . sprintf("%02d:%02d:00", $hour, $minute);
                    } elseif ($random <= $habit['rate'] + 10) {
                        $status = 'missed';
                    }
                }
            } else {
                // Normal distribution based on completion rate
                if ($random <= $habit['rate']) {
                    $status = 'completed';
                    // Random time during the day
                    $hour = rand(6, 22);
                    $minute = rand(0, 59);
                    $completed_at = "$date " . sprintf("%02d:%02d:00", $hour, $minute);
                } elseif ($random <= $habit['rate'] + 10) {
                    // 10% chance of marking as missed
                    $status = 'missed';
                }
                // Otherwise, no entry (pending)
            }

            if ($status !== null) {
                $sql = "INSERT INTO habit_completions (habit_id, completion_date, status, completed_at)
                        VALUES (:habit_id, :completion_date, :status, :completed_at)";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    ':habit_id' => $habit['habit_id'],
                    ':completion_date' => $date,
                    ':status' => $status,
                    ':completed_at' => $completed_at
                ]);
                $inserted++;
            }
        }
    }

    echo "Successfully inserted $inserted habit completions!\n";

    // Display summary
    $summary = $pdo->query("
        SELECT
            'Completions' as Type,
            COUNT(*) as Total,
            SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as Completed,
            SUM(CASE WHEN status='missed' THEN 1 ELSE 0 END) as Missed
        FROM habit_completions
    ")->fetch(PDO::FETCH_ASSOC);

    echo "\n";
    print_r($summary);

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
