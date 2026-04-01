# How to Import Stored Procedures in phpMyAdmin

## ⚠️ IMPORTANT: Import Order

1. **FIRST**: Import `habit_tracker_phpmyadmin.sql` (creates tables)
2. **SECOND**: Import this file `procedures_triggers.sql` (creates procedures & triggers)

## Why Separate Files?

Stored procedures use `DELIMITER` commands that can cause errors when mixed with table creation. This separate file ensures clean imports.

---

## Method 1: Import Entire File (Recommended)

### Step 1: Check Prerequisites
- ✅ Tables already created (run habit_tracker_phpmyadmin.sql first)
- ✅ Database `habit_tracker` exists
- ✅ MySQL is running in XAMPP

### Step 2: Import Using File Upload

1. **Open phpMyAdmin**: `http://localhost/phpmyadmin`
2. **Select Database**: Click `habit_tracker` in left sidebar
3. **Click Import Tab**: At the top
4. **Choose File**: Click "Choose File" button
5. **Select**: `/opt/lampp/htdocs/jira/sql/procedures_triggers.sql`
6. **Important Settings**:
   - Format: SQL
   - ✅ Check "Enable foreign key checks"
   - SQL compatibility mode: NONE
   - Character set: utf8
7. **Click "Go"** at the bottom
8. **Wait for success message**

### Step 3: Verify Installation

Click **SQL** tab and run:

```sql
-- Check procedures
SELECT ROUTINE_NAME, ROUTINE_TYPE
FROM information_schema.ROUTINES
WHERE ROUTINE_SCHEMA = 'habit_tracker';
```

You should see:
- ✅ `update_user_xp` (PROCEDURE)
- ✅ `update_user_streak` (PROCEDURE)

```sql
-- Check triggers
SELECT TRIGGER_NAME
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = 'habit_tracker';
```

You should see:
- ✅ `after_habit_completion` (TRIGGER)

---

## Method 2: Copy-Paste Individual Procedures

If Method 1 fails, import each procedure separately:

### Procedure 1: update_user_xp

1. Select `habit_tracker` database
2. Click **SQL** tab
3. Copy and paste **THIS ENTIRE BLOCK**:

```sql
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

    SELECT xp, level INTO current_xp, current_level
    FROM users WHERE id = p_user_id;

    SET current_xp = current_xp + p_xp_gained;
    SET xp_for_next_level = 100 * current_level;

    WHILE current_xp >= xp_for_next_level DO
        SET current_xp = current_xp - xp_for_next_level;
        SET current_level = current_level + 1;
        SET xp_for_next_level = 100 * current_level;
    END WHILE;

    UPDATE users
    SET xp = current_xp, level = current_level
    WHERE id = p_user_id;
END$$

DELIMITER ;
```

4. Click **Go**
5. You should see: "Procedure `update_user_xp` has been created"

### Procedure 2: update_user_streak

1. Click **SQL** tab again (clear previous query)
2. Copy and paste **THIS ENTIRE BLOCK**:

```sql
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

    SELECT current_streak, best_streak INTO current_streak_val, best_streak_val
    FROM users WHERE id = p_user_id;

    SELECT COUNT(DISTINCT hc.habit_id) INTO yesterday_completions
    FROM habit_completions hc
    INNER JOIN habits h ON hc.habit_id = h.id
    WHERE h.user_id = p_user_id
        AND hc.completion_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        AND hc.status = 'completed';

    SELECT COUNT(DISTINCT hc.habit_id) INTO today_completions
    FROM habit_completions hc
    INNER JOIN habits h ON hc.habit_id = h.id
    WHERE h.user_id = p_user_id
        AND hc.completion_date = CURDATE()
        AND hc.status = 'completed';

    IF today_completions > 0 THEN
        IF yesterday_completions > 0 THEN
            SET current_streak_val = current_streak_val + 1;
        ELSE
            SET current_streak_val = 1;
        END IF;
        IF current_streak_val > best_streak_val THEN
            SET best_streak_val = current_streak_val;
        END IF;
    ELSE
        IF yesterday_completions = 0 THEN
            SET current_streak_val = 0;
        END IF;
    END IF;

    UPDATE users
    SET current_streak = current_streak_val, best_streak = best_streak_val
    WHERE id = p_user_id;
END$$

DELIMITER ;
```

3. Click **Go**
4. You should see: "Procedure `update_user_streak` has been created"

### Trigger: after_habit_completion

1. Click **SQL** tab again
2. Copy and paste **THIS ENTIRE BLOCK**:

```sql
DELIMITER $$

DROP TRIGGER IF EXISTS `after_habit_completion`$$

CREATE TRIGGER `after_habit_completion`
AFTER UPDATE ON `habit_completions`
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT UNSIGNED;

    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        SELECT user_id INTO v_user_id FROM habits WHERE id = NEW.habit_id;
        CALL update_user_xp(v_user_id, 10);
        CALL update_user_streak(v_user_id);
    END IF;
END$$

DELIMITER ;
```

3. Click **Go**
4. You should see: "Trigger `after_habit_completion` has been created"

---

## Testing Your Setup

### Test 1: Manual XP Award

```sql
-- Give demo user 50 XP (should level up to Level 2 if starting at 0 XP)
CALL update_user_xp(1, 50);

-- Check result
SELECT id, name, level, xp FROM users WHERE id = 1;
```

**Expected Result:**
- Level: 1→2 (if XP was 0→50)
- XP: 50 remaining after level up

### Test 2: Automatic XP via Trigger

```sql
-- Create a habit completion entry
INSERT INTO habit_completions (habit_id, completion_date, status)
VALUES (1, CURDATE(), 'pending');

-- Update to completed (trigger should award 10 XP automatically)
UPDATE habit_completions
SET status = 'completed', completed_at = NOW()
WHERE habit_id = 1 AND completion_date = CURDATE();

-- Check if XP was awarded
SELECT id, name, level, xp, current_streak FROM users WHERE id = 1;
```

**Expected Result:**
- XP increased by 10
- Current streak updated

### Test 3: Verify Streak Calculation

```sql
-- Complete multiple habits today
UPDATE habit_completions
SET status = 'completed', completed_at = NOW()
WHERE habit_id IN (2, 3) AND completion_date = CURDATE();

-- Check streak
SELECT current_streak, best_streak FROM users WHERE id = 1;
```

---

## Common Errors & Solutions

### ❌ Error: "#1064 - You have an error in your SQL syntax near 'DELIMITER'"

**Solution:**
- phpMyAdmin has DELIMITER issues
- Use Method 2 (copy-paste individual blocks)
- Make sure to include `DELIMITER $$` at the start and `DELIMITER ;` at the end

### ❌ Error: "Procedure already exists"

**Solution:**
The SQL includes `DROP PROCEDURE IF EXISTS`, but if it still fails:

```sql
-- Drop manually first
DROP PROCEDURE IF EXISTS update_user_xp;
DROP PROCEDURE IF EXISTS update_user_streak;
DROP TRIGGER IF EXISTS after_habit_completion;
```

Then re-import.

### ❌ Error: "#1305 - PROCEDURE update_user_xp does not exist"

**Solution:**
- Procedure didn't create successfully
- Check you're in the correct database (`habit_tracker`)
- Try Method 2 (individual copy-paste)

### ❌ Error: "#1363 - There is no ... user defined"

**Solution:**
MySQL permissions issue. Run:

```sql
GRANT ALL PRIVILEGES ON habit_tracker.* TO 'root'@'localhost';
FLUSH PRIVILEGES;
```

---

## Verification Checklist

- [ ] Tables created (5 tables: users, habits, etc.)
- [ ] Procedures created (2 procedures: update_user_xp, update_user_streak)
- [ ] Trigger created (1 trigger: after_habit_completion)
- [ ] Test 1 passed: Manual XP award works
- [ ] Test 2 passed: Automatic XP via trigger works
- [ ] Test 3 passed: Streak calculation works

---

## How the System Works

### XP System:
- **10 XP** per habit completion (automatic via trigger)
- **Level formula**: 100 XP × current level
  - Level 1→2: needs 100 XP
  - Level 2→3: needs 200 XP
  - Level 3→4: needs 300 XP
- Excess XP carries over to next level

### Streak System:
- Counts consecutive days with at least 1 completed habit
- **Current Streak**: Active streak
- **Best Streak**: All-time record
- Resets to 0 if you miss a day

### Trigger Flow:
1. User marks habit as "completed"
2. Trigger fires automatically
3. Awards 10 XP → calls `update_user_xp()`
4. Updates streak → calls `update_user_streak()`
5. User levels up if enough XP

---

## Alternative: No Procedures Version

If you can't get procedures to work, you can handle XP and streaks in your PHP backend instead:

```php
// PHP example
function awardXP($user_id, $xp_gained) {
    // Get current XP and level
    // Calculate new level
    // Update database
}
```

This gives you more control but requires backend implementation.

---

**✅ Once procedures are installed, your gamification system is fully automated!**
