<?php
require_once '../config/database.php';
require_once '../config/mailer.php';

setCorsHeaders();
$db = (new Database())->getConnection();
ensurePasswordResetColumns($db);

$data = getJsonInput();
$email = trim($data['email'] ?? '');

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendResponse(['success' => false, 'message' => 'Valid email is required'], 400);
}

try {
    $stmt = $db->prepare('SELECT id, password_reset_request_time, password_reset_resend_count FROM users WHERE email = :email AND is_active = TRUE LIMIT 1');
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        sendResponse([
            'success' => true,
            'message' => 'If that email exists, an OTP has been sent.',
            'resend_count' => 0,
            'wait' => 0
        ]);
    }

    $now = new DateTime('now', new DateTimeZone('UTC'));
    $resendCount = (int)($user['password_reset_resend_count'] ?? 0);
    $requestTime = $user['password_reset_request_time'] ? new DateTime($user['password_reset_request_time'], new DateTimeZone('UTC')) : null;
    $wait = 0;

    if ($requestTime) {
        $elapsed = $now->getTimestamp() - $requestTime->getTimestamp();
        if ($elapsed < 50) {
            $wait = 50 - $elapsed;
            if ($resendCount >= 3) {
                sendResponse(['success' => false, 'message' => 'Resend limit reached', 'resend_count' => $resendCount, 'wait' => 0], 429);
            }
            sendResponse(['success' => false, 'message' => "Please wait {$wait} seconds before resending.", 'resend_count' => $resendCount, 'wait' => $wait], 429);
        }
    }

    if ($resendCount >= 3) {
        sendResponse(['success' => false, 'message' => 'Resend limit reached', 'resend_count' => $resendCount, 'wait' => 0], 429);
    }

    $resendCount = max(1, $resendCount + 1);
    $otpCode = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $expiresAt = $now->modify('+1 minute')->format('Y-m-d H:i:s');
    $requestTimeSql = (new DateTime('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');

    $update = $db->prepare('UPDATE users SET password_reset_code = :code, password_reset_expires_at = :expires, password_reset_request_time = :request_time, password_reset_resend_count = :resend_count WHERE id = :id');
    $update->execute([
        ':code' => $otpCode,
        ':expires' => $expiresAt,
        ':request_time' => $requestTimeSql,
        ':resend_count' => $resendCount,
        ':id' => $user['id']
    ]);

    // Send OTP email
    $subject = 'Habit Tracker Password Reset OTP';
    $message = "<h3>Password Reset Request</h3>
                <p>Your One-Time Password (OTP) is: <strong>$otpCode</strong></p>
                <p>This code will expire in 1 minute.</p>";
    
    $mailSent = sendEmail($email, $subject, $message);

    if (!$mailSent) {
        error_log("Failed to send password reset OTP to {$email}");
        sendResponse(['success' => false, 'message' => 'Could not send OTP email. Please try again later.'], 500);
    }

    sendResponse([
        'success' => true,
        'message' => 'OTP sent to your email. It is valid for 1 minute.',
        'resend_count' => $resendCount,
        'wait' => 50
    ]);
} catch (PDOException $e) {
    sendResponse(['success' => false, 'message' => 'Server error'], 500);
}
