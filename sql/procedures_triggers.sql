-- ============================================
-- HABIT TRACKER - STORED PROCEDURES & TRIGGERS
-- phpMyAdmin Compatible Version
-- ============================================
-- IMPORTANT: Run this AFTER creating the main tables!
-- Instructions:
-- 1. First import: habit_tracker_phpmyadmin.sql
-- 2. Then import: this file (procedures_triggers.sql)
-- 3. Import ONE procedure at a time in phpMyAdmin
-- ============================================

-- ============================================
-- PROCEDURE 1: Update User XP and Level
-- Copy and paste THIS ENTIRE BLOCK (including DELIMITER lines)
-- ============================================

DELIMITER $$

DROP PROCEDURE IF EXISTS `update_user_xp`$$

CREATE PROCEDURE `update_user_xp`(
    IN p_user_id INT UNSIGNED,
    IN p_xp_gained INT
)
BEGIN
    DECLARE current_xp INT;
    DECLARE current_level INT;
    DECLARE xp_for_next_level INT;

    -- Get current XP and level
    SELECT xp, level INTO current_xp, current_level
    FROM users
    WHERE id = p_user_id;

    -- Add XP
    SET current_xp = current_xp + p_xp_gained;

    -- Calculate XP needed for next level (100 * level)
    SET xp_for_next_level = 100 * current_level;

    -- Level up if needed
    WHILE current_xp >= xp_for_next_level DO
        SET current_xp = current_xp - xp_for_next_level;
        SET current_level = current_level + 1;
        SET xp_for_next_level = 100 * current_level;
    END WHILE;

    -- Update user
    UPDATE users
    SET xp = current_xp, level = current_level
    WHERE id = p_user_id;
END$$

DELIMITER ;

-- ============================================
-- PROCEDURE 2: Update User Streak
-- Copy and paste THIS ENTIRE BLOCK (including DELIMITER lines)
-- ============================================

DELIMITER $$

DROP PROCEDURE IF EXISTS `update_user_streak`$$

CREATE PROCEDURE `update_user_streak`(
    IN p_user_id INT UNSIGNED
)
BEGIN
    DECLARE yesterday_completions INT;
    DECLARE today_completions INT;
    DECLARE current_streak_val INT;
    DECLARE best_streak_val INT;

    -- Get current streaks
    SELECT current_streak, best_streak INTO current_streak_val, best_streak_val
    FROM users
    WHERE id = p_user_id;

    -- Check if user completed at least one habit yesterday
    SELECT COUNT(DISTINCT hc.habit_id) INTO yesterday_completions
    FROM habit_completions hc
    INNER JOIN habits h ON hc.habit_id = h.id
    WHERE h.user_id = p_user_id
        AND hc.completion_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        AND hc.status = 'completed';

    -- Check if user completed at least one habit today
    SELECT COUNT(DISTINCT hc.habit_id) INTO today_completions
    FROM habit_completions hc
    INNER JOIN habits h ON hc.habit_id = h.id
    WHERE h.user_id = p_user_id
        AND hc.completion_date = CURDATE()
        AND hc.status = 'completed';

    -- Update streak
    IF today_completions > 0 THEN
        IF yesterday_completions > 0 THEN
            SET current_streak_val = current_streak_val + 1;
        ELSE
            SET current_streak_val = 1;
        END IF;

        -- Update best streak if current is higher
        IF current_streak_val > best_streak_val THEN
            SET best_streak_val = current_streak_val;
        END IF;
    ELSE
        IF yesterday_completions = 0 THEN
            SET current_streak_val = 0;
        END IF;
    END IF;

    -- Update user
    UPDATE users
    SET current_streak = current_streak_val,
        best_streak = best_streak_val
    WHERE id = p_user_id;
END$$

DELIMITER ;

-- ============================================
-- TRIGGER: Award XP when habit is completed
-- Copy and paste THIS ENTIRE BLOCK (including DELIMITER lines)
-- ============================================

DELIMITER $$

DROP TRIGGER IF EXISTS `after_habit_completion`$$

CREATE TRIGGER `after_habit_completion`
AFTER UPDATE ON `habit_completions`
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT UNSIGNED;

    -- Only if status changed to completed
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Get user_id from habit
        SELECT user_id INTO v_user_id
        FROM habits
        WHERE id = NEW.habit_id;

        -- Award 10 XP for each completion
        CALL update_user_xp(v_user_id, 10);

        -- Update streak
        CALL update_user_streak(v_user_id);
    END IF;
END$$

DELIMITER ;

-- ============================================
-- VERIFICATION QUERIES
-- Run these to test if procedures work
-- ============================================

-- Test 1: Check if procedures exist
SELECT
    ROUTINE_NAME,
    ROUTINE_TYPE,
    CREATED
FROM information_schema.ROUTINES
WHERE ROUTINE_SCHEMA = 'habit_tracker';

-- Test 2: Check if trigger exists
SELECT
    TRIGGER_NAME,
    EVENT_MANIPULATION,
    EVENT_OBJECT_TABLE
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = 'habit_tracker';

-- Test 3: Test XP procedure (give demo user 50 XP)
CALL update_user_xp(1, 50);

-- Test 4: Check if XP was updated
SELECT id, name, level, xp FROM users WHERE id = 1;

-- Test 5: Test by completing a habit
-- First, create a completion entry
INSERT INTO habit_completions (habit_id, completion_date, status)
VALUES (1, CURDATE(), 'pending')
ON DUPLICATE KEY UPDATE status = 'pending';

-- Then update it to completed (trigger should fire)
UPDATE habit_completions
SET status = 'completed', completed_at = NOW()
WHERE habit_id = 1 AND completion_date = CURDATE();

-- Test 6: Check if XP was awarded automatically
SELECT id, name, level, xp, current_streak FROM users WHERE id = 1;

-- ============================================
-- END OF PROCEDURES & TRIGGERS
-- ============================================
