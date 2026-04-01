# Database Installation Guide

## Quick Start

Follow these steps to set up the Habit Tracker database:

## Method 1: Using phpMyAdmin (Easiest)

1. **Open phpMyAdmin**
   - Start XAMPP/LAMP
   - Visit: `http://localhost/phpmyadmin`

2. **Create Database**
   - Click on "New" in the left sidebar
   - Or the database will be created automatically when you import the SQL file

3. **Import SQL File**
   - Click on "Import" tab at the top
   - Click "Choose File"
   - Select: `sql/habit_tracker_schema.sql`
   - Click "Go" at the bottom
   - Wait for success message

4. **Verify Installation**
   - Select `habit_tracker` database from left sidebar
   - You should see these tables:
     - users
     - habits
     - habit_completions
     - user_achievements
     - user_settings

## Method 2: Using MySQL Command Line

1. **Open Terminal/Command Prompt**

2. **Navigate to Project Directory**
   ```bash
   cd /opt/lampp/htdocs/jira
   ```

3. **Import SQL File**
   ```bash
   mysql -u root -p < sql/habit_tracker_schema.sql
   ```
   - Press Enter
   - Enter your MySQL root password (usually blank for XAMPP)

4. **Verify Installation**
   ```bash
   mysql -u root -p
   ```
   Then run:
   ```sql
   USE habit_tracker;
   SHOW TABLES;
   DESCRIBE users;
   ```

## Method 3: Using MySQL Workbench

1. **Open MySQL Workbench**

2. **Connect to Your Database**
   - Click on your local instance

3. **Open SQL File**
   - File → Open SQL Script
   - Select: `sql/habit_tracker_schema.sql`

4. **Execute Script**
   - Click the lightning bolt icon (Execute)
   - Wait for success message

5. **Refresh Schemas**
   - Right-click "Schemas" in left panel
   - Click "Refresh All"
   - Expand `habit_tracker` to see tables

## Database Structure Overview

### Tables Created:

1. **users** (10 columns)
   - Stores user accounts, authentication, levels, XP, streaks
   - Sample data: 1 demo user included

2. **habits** (13 columns)
   - Stores user habits with categories and settings
   - Sample data: 4 demo habits for the demo user

3. **habit_completions** (8 columns)
   - Tracks daily habit completion status
   - Empty initially

4. **user_achievements** (6 columns)
   - Stores earned achievements
   - Empty initially

5. **user_settings** (8 columns)
   - User preferences and settings
   - Sample data: settings for demo user

### Views Created:

1. **view_user_stats**
   - Aggregated statistics per user

2. **view_todays_habits**
   - Today's habits for all users with status

### Stored Procedures:

1. **update_user_xp(user_id, xp_gained)**
   - Adds XP and handles level-ups

2. **update_user_streak(user_id)**
   - Calculates and updates streaks

### Triggers:

1. **after_habit_completion**
   - Automatically awards XP when habits are completed

## Sample Data Included

The schema includes sample data for testing:

**Demo User:**
- Email: `demo@habittracker.com`
- Password: `password123`
- Name: Demo User
- Level: 1, XP: 0

**Demo Habits:**
1. Morning Exercise (Health)
2. Read for 30 minutes (Study)
3. Drink 8 glasses of water (Health)
4. Meditate (Mind)

## Testing the Database

Run these queries to verify everything works:

```sql
-- View all users
SELECT * FROM users;

-- View all habits
SELECT * FROM habits;

-- View user stats
SELECT * FROM view_user_stats;

-- Test XP procedure (awards 50 XP to user 1)
CALL update_user_xp(1, 50);

-- Check updated stats
SELECT id, name, level, xp FROM users WHERE id = 1;
```

## Common Issues & Solutions

### Issue 1: "Table already exists"
**Solution:** Drop the database first:
```sql
DROP DATABASE IF EXISTS habit_tracker;
```
Then re-import the SQL file.

### Issue 2: "Access denied"
**Solution:** Check your MySQL credentials:
```bash
mysql -u root -p
```
If you forgot your password, reset it via XAMPP/LAMP control panel.

### Issue 3: "Can't create database"
**Solution:** Make sure MySQL is running:
- XAMPP: Click "Start" for MySQL module
- Check status: `sudo /opt/lampp/lampp status`

### Issue 4: Encoding/charset errors
**Solution:** The schema uses `utf8mb4` which is standard. If you see errors:
1. Change to `utf8`: Find/Replace `utf8mb4` with `utf8`
2. Or ensure your MySQL version is 5.5.3+

## Database Connection (PHP)

Create `config/database.php`:

```php
<?php
class Database {
    private $host = "localhost";
    private $db_name = "habit_tracker";
    private $username = "root";
    private $password = "";
    private $conn;

    public function getConnection() {
        $this->conn = null;
        try {
            $this->conn = new PDO(
                "mysql:host=" . $this->host . ";dbname=" . $this->db_name,
                $this->username,
                $this->password
            );
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->conn->exec("set names utf8mb4");
        } catch(PDOException $e) {
            echo "Connection Error: " . $e->getMessage();
        }
        return $this->conn;
    }
}
?>
```

## Next Steps

1. ✅ Database created and sample data loaded
2. ⏭️ Create PHP API endpoints (see README.md)
3. ⏭️ Update JavaScript to call API instead of localStorage
4. ⏭️ Test authentication flow
5. ⏭️ Test habit CRUD operations

## Backup Your Database

To backup your database:

```bash
mysqldump -u root -p habit_tracker > backup_$(date +%Y%m%d).sql
```

To restore from backup:

```bash
mysql -u root -p habit_tracker < backup_YYYYMMDD.sql
```

## Database Management Tools

Popular tools for managing your database:
- **phpMyAdmin** (built into XAMPP)
- **MySQL Workbench** (official MySQL GUI)
- **DBeaver** (cross-platform, free)
- **HeidiSQL** (Windows, free)
- **TablePlus** (Mac, paid)

---

**✅ Database installation complete! You're ready to build the backend API.**
