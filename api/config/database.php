<?php
/**
 * Database Configuration
 * Provides database connection for the Habit Tracker API
 */

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
 * Set CORS headers for API access
 */
function setCorsHeaders() {
    header("Access-Control-Allow-Origin: *");
    header("Content-Type: application/json; charset=UTF-8");
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    header("Access-Control-Max-Age: 3600");
    header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

    // Handle OPTIONS request
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

/**
 * Get JSON input from request body
 */
function getJsonInput() {
    return json_decode(file_get_contents("php://input"), true);
}

/**
 * Send JSON response
 */
function sendResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit;
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
