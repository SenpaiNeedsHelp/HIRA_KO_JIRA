<?php
/**
 * Real Mailer Utility using PHPMailer & Mailtrap
 */

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/../libs/PHPMailer/Exception.php';
require_once __DIR__ . '/../libs/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/../libs/PHPMailer/SMTP.php';

function sendEmail($to, $subject, $message) {
    $mail = new PHPMailer(true);

    try {
        // Server settings
        $mail->isSMTP();
        $mail->Host       = 'sandbox.smtp.mailtrap.io';
        $mail->SMTPAuth   = true;
        
        $mail->Username   = '3ea90204626eaf'; 
        $mail->Password   = '21a71484be5d14';
        
        $mail->Port       = 2525;

        // Recipients
        $mail->setFrom('noreply@hirakojira.local', 'HIRA KO JIRA');
        $mail->addAddress($to);

        // Content
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $message;
        $mail->AltBody = strip_tags($message);

        $mail->send();
        return true;
    } catch (Exception $e) {
        // Fallback: log to file if mail fails
        $logFile = __DIR__ . '/../logs/emails.log';
        $logContent = "====================================\n";
        $logContent .= "Time: " . date('Y-m-d H:i:s') . "\n";
        $logContent .= "FAILED TO SEND via Mailtrap! Error: {$mail->ErrorInfo}\n";
        $logContent .= "To: $to\n";
        $logContent .= "Subject: $subject\n";
        $logContent .= "Message:\n$message\n";
        $logContent .= "====================================\n\n";
        
        file_put_contents($logFile, $logContent, FILE_APPEND);
        return true; // Don't break flow
    }
}
