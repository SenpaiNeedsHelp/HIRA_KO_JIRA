<?php
/**
 * Database Configuration
 * Provides database connection for the Habit Tracker API
 */

require_once __DIR__ . '/../utils/response.php';

class Database {
    private $host = "localhost";
    private $db_name = "habit_tracker";
    private $username = "root";
    private $password = "";
    public $conn;

    /**
     * Get database connection
     * @return PDO Database connection object
     */
    public function getConnection() {
        $this->conn = null;

        try {
            $this->conn = new PDO(
                "mysql:host=" . $this->host . ";dbname=" . $this->db_name . ";charset=utf8mb4",
                $this->username,
                $this->password
            );
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        } catch(PDOException $e) {
            echo json_encode([
                'success' => false,
                'message' => 'Connection failed: ' . $e->getMessage()
            ]);
            exit;
        }

        return $this->conn;
    }
}

/**
 * Ensure password reset columns exist on users table
 */
function ensurePasswordResetColumns($pdo) {
    $queries = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_code VARCHAR(10) NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at DATETIME NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_request_time DATETIME NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_resend_count TINYINT UNSIGNED NOT NULL DEFAULT 0"
    ];

    foreach ($queries as $sql) {
        $pdo->exec($sql);
    }
}

/**
 * Verify user session
 */
function verifySession($pdo) {
    session_start();

    if (!isset($_SESSION['user_id'])) {
        sendResponse([
            'success' => false,
            'message' => 'Not authenticated'
        ], 401);
    }

    return $_SESSION['user_id'];
}
?>
