-- ============================================
-- HABIT TRACKER DATABASE SCHEMA
-- phpMyAdmin Compatible Version
-- ============================================
-- Instructions:
-- 1. Open phpMyAdmin (http://localhost/phpmyadmin)
-- 2. Click "New" to create database OR select existing database
-- 3. Name it: habit_tracker
-- 4. Set Collation: utf8mb4_unicode_ci
-- 5. Click "SQL" tab
-- 6. Copy and paste this ENTIRE file
-- 7. Click "Go"
-- ============================================

-- ============================================
-- TABLE: users
-- Description: Stores user account information, authentication, and progress
-- ============================================
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `email` VARCHAR(255) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `avatar` TEXT NULL COMMENT 'Base64 encoded image or file path',
    `level` INT UNSIGNED NOT NULL DEFAULT 1,
    `xp` INT UNSIGNED NOT NULL DEFAULT 0,
    `current_streak` INT UNSIGNED NOT NULL DEFAULT 0,
    `best_streak` INT UNSIGNED NOT NULL DEFAULT 0,
    `member_since` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `last_login` TIMESTAMP NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX `idx_email` (`email`),
    INDEX `idx_level` (`level`),
    INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: habits
-- Description: Stores user habits and their properties
-- ============================================
CREATE TABLE IF NOT EXISTS `habits` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `category` ENUM('Health', 'Study', 'Work', 'Personal', 'Fitness', 'Mind', 'Social', 'Other') NOT NULL DEFAULT 'Other',
    `description` TEXT NULL,
    `color` VARCHAR(7) NULL COMMENT 'Hex color code for UI display',
    `icon` VARCHAR(50) NULL COMMENT 'Icon identifier or emoji',
    `is_archived` BOOLEAN NOT NULL DEFAULT FALSE,
    `display_order` INT UNSIGNED NOT NULL DEFAULT 0,
    `frequency` ENUM('daily', 'weekly', 'custom') NOT NULL DEFAULT 'daily',
    `target_days` JSON NULL COMMENT 'For weekly/custom frequency: [0,1,2,3,4,5,6] where 0=Sunday',
    `reminder_time` TIME NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,

    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_category` (`category`),
    INDEX `idx_is_archived` (`is_archived`),
    INDEX `idx_user_archived` (`user_id`, `is_archived`),
    INDEX `idx_display_order` (`display_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: habit_completions
-- Description: Tracks daily habit completion status
-- ============================================
CREATE TABLE IF NOT EXISTS `habit_completions` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `habit_id` INT UNSIGNED NOT NULL,
    `completion_date` DATE NOT NULL,
    `status` ENUM('completed', 'missed', 'pending') NOT NULL DEFAULT 'pending',
    `notes` TEXT NULL COMMENT 'Optional notes for the day',
    `completed_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,

    UNIQUE KEY `unique_habit_date` (`habit_id`, `completion_date`),
    INDEX `idx_habit_id` (`habit_id`),
    INDEX `idx_completion_date` (`completion_date`),
    INDEX `idx_status` (`status`),
    INDEX `idx_habit_date_status` (`habit_id`, `completion_date`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: user_achievements
-- Description: Tracks user achievements and milestones
-- ============================================
CREATE TABLE IF NOT EXISTS `user_achievements` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `achievement_type` ENUM('first_habit', 'week_streak', 'month_streak', '100_days', 'perfect_week', 'level_5', 'level_10', 'habit_master') NOT NULL,
    `achievement_name` VARCHAR(100) NOT NULL,
    `achievement_description` TEXT NULL,
    `earned_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,

    UNIQUE KEY `unique_user_achievement` (`user_id`, `achievement_type`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_achievement_type` (`achievement_type`),
    INDEX `idx_earned_at` (`earned_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: user_settings
-- Description: Stores user preferences and settings
-- ============================================
CREATE TABLE IF NOT EXISTS `user_settings` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL UNIQUE,
    `theme` ENUM('light', 'dark', 'auto') NOT NULL DEFAULT 'auto',
    `notifications_enabled` BOOLEAN NOT NULL DEFAULT FALSE,
    `weekly_report_enabled` BOOLEAN NOT NULL DEFAULT FALSE,
    `notification_time` TIME NULL DEFAULT '09:00:00',
    `timezone` VARCHAR(50) NOT NULL DEFAULT 'UTC',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,

    INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SAMPLE DATA (for testing)
-- ============================================

-- Insert sample user (password: 'password' - hashed with bcrypt)
-- Note: In production, use proper password hashing on the backend
INSERT INTO `users` (`email`, `password_hash`, `name`, `level`, `xp`) VALUES
('demo@habittracker.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Demo User', 1, 0);

-- Insert sample habits for demo user
INSERT INTO `habits` (`user_id`, `name`, `category`, `display_order`) VALUES
(1, 'Morning Exercise', 'Health', 1),
(1, 'Read for 30 minutes', 'Study', 2),
(1, 'Drink 8 glasses of water', 'Health', 3),
(1, 'Meditate', 'Mind', 4);

-- Create default settings for sample user
INSERT INTO `user_settings` (`user_id`, `theme`) VALUES (1, 'auto');

-- ============================================
-- Additional performance indexes
-- ============================================
CREATE INDEX `idx_habits_user_category` ON `habits`(`user_id`, `category`);
CREATE INDEX `idx_completions_date_status` ON `habit_completions`(`completion_date`, `status`);

-- ============================================
-- VIEWS (Run these after tables are created)
-- ============================================

-- Drop views if they exist
DROP VIEW IF EXISTS `view_user_stats`;
DROP VIEW IF EXISTS `view_todays_habits`;

-- View: User statistics overview
CREATE VIEW `view_user_stats` AS
SELECT
    u.id AS user_id,
    u.name,
    u.email,
    u.level,
    u.xp,
    u.current_streak,
    u.best_streak,
    COUNT(DISTINCT h.id) AS total_habits,
    COUNT(DISTINCT CASE WHEN h.is_archived = FALSE THEN h.id END) AS active_habits,
    COUNT(DISTINCT CASE WHEN hc.status = 'completed' THEN hc.id END) AS total_completions,
    ROUND(
        (COUNT(CASE WHEN hc.status = 'completed' THEN 1 END) * 100.0) /
        NULLIF(COUNT(hc.id), 0),
        2
    ) AS completion_rate
FROM `users` u
LEFT JOIN `habits` h ON u.id = h.user_id
LEFT JOIN `habit_completions` hc ON h.id = hc.habit_id
GROUP BY u.id, u.name, u.email, u.level, u.xp, u.current_streak, u.best_streak;

-- View: Today's habits for all users
CREATE VIEW `view_todays_habits` AS
SELECT
    h.id AS habit_id,
    h.user_id,
    h.name AS habit_name,
    h.category,
    COALESCE(hc.status, 'pending') AS status,
    CURDATE() AS completion_date
FROM `habits` h
LEFT JOIN `habit_completions` hc ON h.id = hc.habit_id AND hc.completion_date = CURDATE()
WHERE h.is_archived = FALSE;

-- ============================================
-- END OF SCHEMA
-- ============================================
-- Next Steps:
-- 1. Access your app at: http://localhost/jira/index.html
-- 2. Login with: demo@habittracker.com / password123
-- 3. Create PHP API to connect frontend to database
-- ============================================
