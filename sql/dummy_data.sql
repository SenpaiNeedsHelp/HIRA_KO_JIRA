-- ============================================
-- DUMMY DATA FOR HABIT TRACKER
-- ============================================
-- This file contains sample data for testing
-- Password for all users: password
-- ============================================

USE habit_tracker;

-- Clear existing data (optional - comment out if you want to keep existing data)
-- DELETE FROM habit_completions;
-- DELETE FROM user_achievements;
-- DELETE FROM user_settings;
-- DELETE FROM habits;
-- DELETE FROM users;
-- ALTER TABLE users AUTO_INCREMENT = 1;
-- ALTER TABLE habits AUTO_INCREMENT = 1;
-- ALTER TABLE habit_completions AUTO_INCREMENT = 1;

-- ============================================
-- INSERT USERS
-- ============================================
-- Password: password (hashed with bcrypt)
INSERT INTO users (email, password_hash, name, avatar, level, xp, current_streak, best_streak, member_since, last_login) VALUES
('john.doe@email.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'John Doe', NULL, 5, 250, 12, 28, '2026-01-15 08:00:00', '2026-03-31 09:30:00'),
('jane.smith@email.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Jane Smith', NULL, 3, 180, 7, 15, '2026-02-01 10:00:00', '2026-03-30 18:45:00'),
('mike.johnson@email.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Mike Johnson', NULL, 8, 450, 20, 35, '2025-12-10 12:00:00', '2026-03-31 07:15:00'),
('sarah.wilson@email.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Sarah Wilson', NULL, 2, 85, 3, 8, '2026-03-01 14:30:00', '2026-03-30 20:00:00'),
('demo@habittracker.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Demo User', NULL, 4, 320, 15, 22, '2026-01-01 00:00:00', '2026-04-01 08:00:00');

-- ============================================
-- INSERT USER SETTINGS
-- ============================================
INSERT INTO user_settings (user_id, theme, notifications_enabled, weekly_report_enabled, notification_time, timezone) VALUES
(1, 'dark', TRUE, TRUE, '08:00:00', 'America/New_York'),
(2, 'light', TRUE, FALSE, '09:00:00', 'Europe/London'),
(3, 'dark', FALSE, FALSE, '07:00:00', 'Asia/Tokyo'),
(4, 'auto', TRUE, TRUE, '10:00:00', 'America/Los_Angeles'),
(5, 'light', TRUE, FALSE, '09:00:00', 'UTC');

-- ============================================
-- INSERT HABITS FOR USER 1 (John Doe)
-- ============================================
INSERT INTO habits (user_id, name, category, description, color, icon, is_archived, display_order, frequency) VALUES
(1, 'Morning Exercise', 'Fitness', '30 minutes of cardio or strength training', '#4CAF50', '🏃', FALSE, 1, 'daily'),
(1, 'Read for 30 minutes', 'Study', 'Read books, articles, or technical docs', '#2196F3', '📚', FALSE, 2, 'daily'),
(1, 'Drink 8 glasses of water', 'Health', 'Stay hydrated throughout the day', '#03A9F4', '💧', FALSE, 3, 'daily'),
(1, 'Meditate', 'Mind', '10 minutes of mindfulness meditation', '#9C27B0', '🧘', FALSE, 4, 'daily'),
(1, 'Practice coding', 'Work', 'Work on personal coding projects', '#FF5722', '💻', FALSE, 5, 'daily'),
(1, 'Journal', 'Personal', 'Write daily reflections and gratitude', '#FF9800', '✍️', FALSE, 6, 'daily'),
(1, 'No social media after 9pm', 'Personal', 'Digital detox before bedtime', '#795548', '📱', FALSE, 7, 'daily'),
(1, 'Learn new language', 'Study', 'Practice Spanish on Duolingo', '#8BC34A', '🌍', TRUE, 8, 'daily');

-- ============================================
-- INSERT HABITS FOR USER 2 (Jane Smith)
-- ============================================
INSERT INTO habits (user_id, name, category, description, color, icon, is_archived, display_order, frequency) VALUES
(2, 'Morning yoga', 'Fitness', '20 minutes of yoga flow', '#4CAF50', '🧘‍♀️', FALSE, 1, 'daily'),
(2, 'Healthy breakfast', 'Health', 'No skipping breakfast', '#FF9800', '🥗', FALSE, 2, 'daily'),
(2, 'Walk 10k steps', 'Fitness', 'Track daily steps', '#2196F3', '👣', FALSE, 3, 'daily'),
(2, 'Skincare routine', 'Personal', 'Morning and evening skincare', '#E91E63', '✨', FALSE, 4, 'daily'),
(2, 'Study for certification', 'Study', 'AWS certification prep', '#FF5722', '📖', FALSE, 5, 'daily');

-- ============================================
-- INSERT HABITS FOR USER 3 (Mike Johnson)
-- ============================================
INSERT INTO habits (user_id, name, category, description, color, icon, is_archived, display_order, frequency) VALUES
(3, 'Wake up at 5 AM', 'Personal', 'Early morning routine', '#FF9800', '⏰', FALSE, 1, 'daily'),
(3, 'Cold shower', 'Health', 'Start day with cold shower', '#03A9F4', '🚿', FALSE, 2, 'daily'),
(3, 'Gym workout', 'Fitness', 'Strength training session', '#4CAF50', '💪', FALSE, 3, 'daily'),
(3, 'Meal prep', 'Health', 'Prepare healthy meals', '#8BC34A', '🍱', FALSE, 4, 'daily'),
(3, 'Read business book', 'Study', '30 pages per day', '#2196F3', '📕', FALSE, 5, 'daily'),
(3, 'Network with 1 person', 'Social', 'Professional networking', '#9C27B0', '🤝', FALSE, 6, 'daily'),
(3, 'Plan tomorrow', 'Work', 'Evening planning session', '#795548', '📋', FALSE, 7, 'daily');

-- ============================================
-- INSERT HABITS FOR USER 4 (Sarah Wilson)
-- ============================================
INSERT INTO habits (user_id, name, category, description, color, icon, is_archived, display_order, frequency) VALUES
(4, 'Morning stretching', 'Fitness', '10 minutes of stretching', '#4CAF50', '🤸‍♀️', FALSE, 1, 'daily'),
(4, 'Gratitude journal', 'Mind', 'Write 3 things I am grateful for', '#FF9800', '🙏', FALSE, 2, 'daily'),
(4, 'No caffeine after 2pm', 'Health', 'Better sleep quality', '#795548', '☕', FALSE, 3, 'daily'),
(4, 'Learn photography', 'Personal', 'Practice photography techniques', '#9C27B0', '📷', FALSE, 4, 'daily');

-- ============================================
-- INSERT HABITS FOR USER 5 (Demo User)
-- ============================================
INSERT INTO habits (user_id, name, category, description, color, icon, is_archived, display_order, frequency) VALUES
(5, 'Morning jog', 'Fitness', '20 minutes jogging in the park', '#4CAF50', '🏃‍♂️', FALSE, 1, 'daily'),
(5, 'Breakfast protein', 'Health', 'Eat protein-rich breakfast', '#FF9800', '🍳', FALSE, 2, 'daily'),
(5, 'Code review', 'Work', 'Review code for 30 minutes', '#FF5722', '👨‍💻', FALSE, 3, 'daily'),
(5, 'Read tech articles', 'Study', 'Stay updated with tech news', '#2196F3', '📰', FALSE, 4, 'daily'),
(5, 'Evening walk', 'Fitness', '15 minutes walk after dinner', '#8BC34A', '🚶', FALSE, 5, 'daily'),
(5, 'No screen 1hr before bed', 'Personal', 'Blue light detox', '#9C27B0', '🌙', FALSE, 6, 'daily');

-- ============================================
-- INSERT HABIT COMPLETIONS (Last 30 days)
-- ============================================

-- User 1 completions (John Doe - consistent user with current streak of 12 days)
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS insert_demo_completions()
BEGIN
    DECLARE i INT DEFAULT 0;
    DECLARE completion_date DATE;
    DECLARE random_val INT;

    -- Last 30 days of completions for User 1 habits
    WHILE i < 30 DO
        SET completion_date = DATE_SUB(CURDATE(), INTERVAL i DAY);

        -- Habit 1: Morning Exercise (90% completion rate)
        SET random_val = FLOOR(RAND() * 100);
        IF random_val < 90 THEN
            INSERT INTO habit_completions (habit_id, completion_date, status, completed_at)
            VALUES (1, completion_date, 'completed', TIMESTAMP(completion_date, '07:30:00'));
        ELSEIF random_val < 95 THEN
            INSERT INTO habit_completions (habit_id, completion_date, status)
            VALUES (1, completion_date, 'missed');
        END IF;

        -- Habit 2: Read for 30 minutes (85% completion rate)
        SET random_val = FLOOR(RAND() * 100);
        IF random_val < 85 THEN
            INSERT INTO habit_completions (habit_id, completion_date, status, completed_at)
            VALUES (2, completion_date, 'completed', TIMESTAMP(completion_date, '21:00:00'));
        ELSEIF random_val < 90 THEN
            INSERT INTO habit_completions (habit_id, completion_date, status)
            VALUES (2, completion_date, 'missed');
        END IF;

        -- Habit 3: Drink water (95% completion rate)
        SET random_val = FLOOR(RAND() * 100);
        IF random_val < 95 THEN
            INSERT INTO habit_completions (habit_id, completion_date, status, completed_at)
            VALUES (3, completion_date, 'completed', TIMESTAMP(completion_date, '20:00:00'));
        END IF;

        -- Habit 4: Meditate (70% completion rate)
        SET random_val = FLOOR(RAND() * 100);
        IF random_val < 70 THEN
            INSERT INTO habit_completions (habit_id, completion_date, status, completed_at)
            VALUES (4, completion_date, 'completed', TIMESTAMP(completion_date, '08:00:00'));
        ELSEIF random_val < 80 THEN
            INSERT INTO habit_completions (habit_id, completion_date, status)
            VALUES (4, completion_date, 'missed');
        END IF;

        -- Habit 5: Practice coding (80% completion rate)
        SET random_val = FLOOR(RAND() * 100);
        IF random_val < 80 THEN
            INSERT INTO habit_completions (habit_id, completion_date, status, completed_at)
            VALUES (5, completion_date, 'completed', TIMESTAMP(completion_date, '19:00:00'));
        ELSEIF random_val < 85 THEN
            INSERT INTO habit_completions (habit_id, completion_date, status)
            VALUES (5, completion_date, 'missed');
        END IF;

        -- Habit 6: Journal (75% completion rate)
        SET random_val = FLOOR(RAND() * 100);
        IF random_val < 75 THEN
            INSERT INTO habit_completions (habit_id, completion_date, status, completed_at)
            VALUES (6, completion_date, 'completed', TIMESTAMP(completion_date, '22:00:00'));
        END IF;

        -- Habit 7: No social media (65% completion rate)
        SET random_val = FLOOR(RAND() * 100);
        IF random_val < 65 THEN
            INSERT INTO habit_completions (habit_id, completion_date, status, completed_at)
            VALUES (7, completion_date, 'completed', TIMESTAMP(completion_date, '21:30:00'));
        ELSEIF random_val < 75 THEN
            INSERT INTO habit_completions (habit_id, completion_date, status)
            VALUES (7, completion_date, 'missed');
        END IF;

        SET i = i + 1;
    END WHILE;

    -- User 2 completions (Jane Smith - moderate user)
    SET i = 0;
    WHILE i < 30 DO
        SET completion_date = DATE_SUB(CURDATE(), INTERVAL i DAY);
        SET random_val = FLOOR(RAND() * 100);

        IF random_val < 70 THEN
            INSERT INTO habit_completions (habit_id, completion_date, status, completed_at)
            VALUES (9, completion_date, 'completed', TIMESTAMP(completion_date, '07:00:00'));
        END IF;

        SET random_val = FLOOR(RAND() * 100);
        IF random_val < 80 THEN
            INSERT INTO habit_completions (habit_id, completion_date, status, completed_at)
            VALUES (10, completion_date, 'completed', TIMESTAMP(completion_date, '08:30:00'));
        END IF;

        SET random_val = FLOOR(RAND() * 100);
        IF random_val < 60 THEN
            INSERT INTO habit_completions (habit_id, completion_date, status, completed_at)
            VALUES (11, completion_date, 'completed', TIMESTAMP(completion_date, '18:00:00'));
        END IF;

        SET i = i + 1;
    END WHILE;

    -- User 3 completions (Mike Johnson - very consistent user)
    SET i = 0;
    WHILE i < 30 DO
        SET completion_date = DATE_SUB(CURDATE(), INTERVAL i DAY);

        SET random_val = FLOOR(RAND() * 100);
        IF random_val < 95 THEN
            INSERT INTO habit_completions (habit_id, completion_date, status, completed_at)
            VALUES (14, completion_date, 'completed', TIMESTAMP(completion_date, '05:00:00'));
        END IF;

        SET random_val = FLOOR(RAND() * 100);
        IF random_val < 90 THEN
            INSERT INTO habit_completions (habit_id, completion_date, status, completed_at)
            VALUES (15, completion_date, 'completed', TIMESTAMP(completion_date, '05:30:00'));
        END IF;

        SET random_val = FLOOR(RAND() * 100);
        IF random_val < 95 THEN
            INSERT INTO habit_completions (habit_id, completion_date, status, completed_at)
            VALUES (16, completion_date, 'completed', TIMESTAMP(completion_date, '06:00:00'));
        END IF;

        SET i = i + 1;
    END WHILE;

    -- User 5 (Demo User) completions - consistent with good streak
    SET i = 0;
    WHILE i < 30 DO
        SET completion_date = DATE_SUB(CURDATE(), INTERVAL i DAY);

        -- Ensure consistent streak for last 15 days
        IF i < 15 THEN
            INSERT INTO habit_completions (habit_id, completion_date, status, completed_at)
            VALUES (22, completion_date, 'completed', TIMESTAMP(completion_date, '06:30:00'));

            INSERT INTO habit_completions (habit_id, completion_date, status, completed_at)
            VALUES (23, completion_date, 'completed', TIMESTAMP(completion_date, '08:00:00'));

            INSERT INTO habit_completions (habit_id, completion_date, status, completed_at)
            VALUES (24, completion_date, 'completed', TIMESTAMP(completion_date, '10:00:00'));

            SET random_val = FLOOR(RAND() * 100);
            IF random_val < 80 THEN
                INSERT INTO habit_completions (habit_id, completion_date, status, completed_at)
                VALUES (25, completion_date, 'completed', TIMESTAMP(completion_date, '12:00:00'));
            END IF;
        ELSE
            SET random_val = FLOOR(RAND() * 100);
            IF random_val < 70 THEN
                INSERT INTO habit_completions (habit_id, completion_date, status, completed_at)
                VALUES (22, completion_date, 'completed', TIMESTAMP(completion_date, '06:30:00'));
            END IF;

            SET random_val = FLOOR(RAND() * 100);
            IF random_val < 75 THEN
                INSERT INTO habit_completions (habit_id, completion_date, status, completed_at)
                VALUES (23, completion_date, 'completed', TIMESTAMP(completion_date, '08:00:00'));
            END IF;
        END IF;

        SET i = i + 1;
    END WHILE;
END //
DELIMITER ;

-- Execute the procedure
CALL insert_demo_completions();

-- Clean up the procedure
DROP PROCEDURE IF EXISTS insert_demo_completions;

-- ============================================
-- INSERT ACHIEVEMENTS
-- ============================================
INSERT INTO user_achievements (user_id, achievement_type, achievement_name, achievement_description, earned_at) VALUES
(1, 'first_habit', 'First Step', 'Created your first habit', '2026-01-15 08:30:00'),
(1, 'week_streak', 'Week Warrior', 'Maintained a 7-day streak', '2026-01-22 10:00:00'),
(1, 'level_5', 'Level 5', 'Reached level 5', '2026-02-20 15:30:00'),
(3, 'first_habit', 'First Step', 'Created your first habit', '2025-12-10 12:30:00'),
(3, 'week_streak', 'Week Warrior', 'Maintained a 7-day streak', '2025-12-17 09:00:00'),
(3, 'month_streak', 'Monthly Master', 'Maintained a 30-day streak', '2026-01-10 11:00:00'),
(3, 'level_5', 'Level 5', 'Reached level 5', '2026-01-25 14:00:00'),
(5, 'first_habit', 'First Step', 'Created your first habit', '2026-01-01 10:00:00'),
(5, 'week_streak', 'Week Warrior', 'Maintained a 7-day streak', '2026-01-08 09:30:00');

-- ============================================
-- VERIFY DATA
-- ============================================
SELECT 'Users created:' AS Info, COUNT(*) AS Count FROM users
UNION ALL
SELECT 'Habits created:', COUNT(*) FROM habits
UNION ALL
SELECT 'Completions logged:', COUNT(*) FROM habit_completions
UNION ALL
SELECT 'Achievements earned:', COUNT(*) FROM user_achievements
UNION ALL
SELECT 'User settings:', COUNT(*) FROM user_settings;

-- ============================================
-- Display sample user credentials
-- ============================================
SELECT
    '===== SAMPLE USER CREDENTIALS =====' AS '';
SELECT
    email AS 'Email',
    'password123' AS 'Password',
    name AS 'Name',
    level AS 'Level',
    current_streak AS 'Streak'
FROM users
ORDER BY id;

-- ============================================
-- END OF DUMMY DATA
-- ============================================
