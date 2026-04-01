# How to Import Database Using XAMPP phpMyAdmin

## Step-by-Step Guide

### Step 1: Start XAMPP

1. Open **XAMPP Control Panel**
2. Click **Start** next to Apache
3. Click **Start** next to MySQL
4. Wait until both show green "Running" status

### Step 2: Open phpMyAdmin

1. Open your web browser
2. Go to: **http://localhost/phpmyadmin**
3. You should see the phpMyAdmin interface

### Step 3: Create Database

**Option A - Create Manually (Recommended):**
1. Click **"New"** in the left sidebar
2. Enter database name: **habitat_tracker**
3. Choose Collation: **utf8mb4_unicode_ci**
4. Click **"Create"**

**Option B - Let SQL create it:**
- Skip this step and the SQL will create it automatically

### Step 4: Import SQL File

**Method 1: Copy-Paste (Most Reliable)**

1. In phpMyAdmin, select **habit_tracker** database from left sidebar (or skip if not created)
2. Click the **"SQL"** tab at the top
3. Open file: `/opt/lampp/htdocs/jira/sql/habit_tracker_phpmyadmin.sql`
4. Copy **ALL** the contents (Ctrl+A, Ctrl+C)
5. Paste into the SQL box in phpMyAdmin
6. Click **"Go"** button at bottom right
7. Wait for success message

**Method 2: File Import**

1. Select **habit_tracker** database
2. Click **"Import"** tab at the top
3. Click **"Choose File"**
4. Navigate to: `/opt/lampp/htdocs/jira/sql/`
5. Select: **habit_tracker_phpmyadmin.sql**
6. Leave all settings as default
7. Scroll down and click **"Go"**
8. Wait for import to complete

### Step 5: Verify Installation

1. In left sidebar, click **habit_tracker** database
2. You should see these **5 tables**:
   - ✅ habits
   - ✅ habit_completions
   - ✅ user_achievements
   - ✅ user_settings
   - ✅ users

3. Click on **users** table
4. Click **"Browse"** tab
5. You should see 1 row: **Demo User** with email `demo@habittracker.com`

### Step 6: Test the Database

Click **"SQL"** tab and run these test queries:

**Test 1: View all users**
```sql
SELECT * FROM users;
```

**Test 2: View demo user's habits**
```sql
SELECT h.*, u.name as user_name
FROM habits h
JOIN users u ON h.user_id = u.id;
```

**Test 3: Check user statistics view**
```sql
SELECT * FROM view_user_stats;
```

## Common Errors & Solutions

### ❌ Error: "MySQL said: #1046 - No database selected"
**Solution:**
1. Click **"New"** in left sidebar
2. Create database: **habit_tracker**
3. Then import again

### ❌ Error: "#1064 - You have an error in your SQL syntax"
**Solution:**
- Use the **habit_tracker_phpmyadmin.sql** file (not the other one)
- Make sure you copied the ENTIRE file content
- Try Method 1 (Copy-Paste) instead of Method 2

### ❌ Error: "#1227 - Access denied"
**Solution:**
- This is a permissions issue
- Use **root** account in phpMyAdmin
- Or grant privileges: Run this in SQL tab:
```sql
GRANT ALL PRIVILEGES ON habit_tracker.* TO 'root'@'localhost';
FLUSH PRIVILEGES;
```

### ❌ Error: "Error in processing request" or timeout
**Solution:**
1. Go to phpMyAdmin config
2. File: `/opt/lampp/phpmyadmin/config.inc.php`
3. Add these lines:
```php
$cfg['ExecTimeLimit'] = 600;
$cfg['UploadDir'] = '';
$cfg['SaveDir'] = '';
```
4. Restart Apache in XAMPP

### ❌ Error: Tables already exist
**Solution:**
Delete the old database:
1. Select **habit_tracker** in left sidebar
2. Click **"Operations"** tab
3. Scroll to bottom
4. Click **"Drop the database (DROP)"**
5. Confirm
6. Import again

## Quick Verification Checklist

- [ ] XAMPP MySQL is running (green)
- [ ] phpMyAdmin opens at http://localhost/phpmyadmin
- [ ] Database **habit_tracker** exists in left sidebar
- [ ] 5 tables are visible (users, habits, etc.)
- [ ] Sample data: 1 user, 4 habits
- [ ] Views work: `SELECT * FROM view_user_stats;`

## Access Your Application

Once database is set up:

1. **Open browser**
2. Go to: **http://localhost/jira/index.html**
3. **Login with demo account:**
   - Email: `demo@habittracker.com`
   - Password: `password123`

⚠️ **Note:** App currently uses localStorage (browser storage). To connect to real database, you need to create PHP API endpoints. See README.md for details.

## Database Credentials

For your PHP backend connection:

```php
$host = "localhost";
$db_name = "habit_tracker";
$username = "root";
$password = "";  // Default XAMPP has empty password
$charset = "utf8mb4";
```

## Next Steps After Installation

1. ✅ Database installed
2. ⏭️ Test the web app (it works with localStorage)
3. ⏭️ Create PHP API files (see README.md)
4. ⏭️ Connect JavaScript to PHP API
5. ⏭️ Test with real database

## Backup Your Database

To backup via phpMyAdmin:

1. Select **habit_tracker** database
2. Click **"Export"** tab
3. Choose **"Quick"** method
4. Format: **SQL**
5. Click **"Go"**
6. Save the .sql file

## Need Help?

- Check if MySQL is running in XAMPP
- Try restarting XAMPP
- Check phpMyAdmin error log: `/opt/lampp/phpmyadmin/tmp/`
- Make sure you're using the correct SQL file: `habit_tracker_phpmyadmin.sql`

---

**✅ Follow these steps and your database will be ready in 5 minutes!**
