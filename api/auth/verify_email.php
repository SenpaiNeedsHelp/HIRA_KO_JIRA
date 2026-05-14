<?php
require_once '../config/database.php';

setCorsHeaders();

$db = (new Database())->getConnection();

$token = $_GET['token'] ?? '';

if (!$token) {
    sendResponse(['success' => false, 'message' => 'Invalid token'], 400);
}

$stmt = $db->prepare("SELECT id FROM users WHERE verification_token = :token");
$stmt->execute(['token' => $token]);

$user = $stmt->fetch();

if (!$user) {
    sendResponse(['success' => false, 'message' => 'Invalid token'], 400);
}

// Verify user
$update = $db->prepare("
    UPDATE users 
    SET is_verified = 1, verification_token = NULL 
    WHERE id = :id
");

$update->execute(['id' => $user['id']]);

// Return HTML since this is accessed via browser from an email link
header("Content-Type: text/html");
echo "
<!DOCTYPE html>
<html>
<head>
    <title>Email Verified - HIRA KO JIRA</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; background-color: #f4f4f9; }
        .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: inline-block; }
        h2 { color: #4CAF50; }
        a { text-decoration: none; color: white; background: #007BFF; padding: 10px 20px; border-radius: 5px; margin-top: 20px; display: inline-block; }
    </style>
</head>
<body>
    <div class='container'>
        <h2>Email Verified Successfully!</h2>
        <p>Your account is now verified. You can log in.</p>
        <a href='/index.html'>Go to Login</a>
    </div>
</body>
</html>
";
exit;