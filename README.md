# Habit Tracker

A modern, responsive web application for tracking daily habits, building streaks, and monitoring personal progress with gamification features.

## Project Structure

```
jira/
├── index.html                      # Login/Signup page
├── dashboard.html                  # Main dashboard page
├── assets/
│   ├── css/
│   │   └── styles.css             # All styles (light/dark theme)
│   └── js/
│       └── script.js              # All application logic
├── sql/
│   └── habit_tracker_schema.sql   # MySQL database schema
└── README.md                       # This file
```

## Features

✨ **User Authentication**
- Login and Sign up functionality
- Profile management with avatar upload
- Password validation

📊 **Dashboard**
- Real-time statistics (active habits, streaks, completion rates)
- Interactive charts (weekly overview, 7-day trend)
- Today's habit checklist

✅ **Habit Management**
- Create, edit, archive habits
- Categorize habits (Health, Study, Work, etc.)
- Filter and sort habits
- Custom ordering

📅 **Calendar Views**
- Heatmap view (90-day activity visualization)
- Month view with status indicators
- Week view with daily breakdown
- Day detail panel

👤 **Profile & Gamification**
- XP system and leveling (Level 1-∞)
- Streak tracking (current & best)
- Profile editing
- Avatar upload (images < 2MB)
- Achievement system ready

🎨 **Theme Support**
- Light and Dark mode
- Smooth transitions
- System preference detection

📤 **Data Management**
- Export data as JSON
- Reset all data option
- Local storage backup

## Database Schema

The application requires a MySQL database with the following tables:

### Tables:
1. **users** - User accounts, authentication, XP, levels, streaks
2. **habits** - User habits with categories and properties
3. **habit_completions** - Daily completion tracking
4. **user_achievements** - Achievement system
5. **user_settings** - User preferences

### Views:
- `view_user_stats` - User statistics overview
- `view_todays_habits` - Today's habits for all users

### Stored Procedures:
- `update_user_xp()` - Handles XP gains and level-ups
- `update_user_streak()` - Updates streak calculations

### Triggers:
- `after_habit_completion` - Awards XP automatically on completion

## Installation

### Prerequisites
- Apache/Nginx web server
- MySQL 5.7+ or MariaDB 10.2+
- PHP 7.4+ (if implementing backend API)

### Step 1: Database Setup

1. Open phpMyAdmin or MySQL command line
2. Import the database schema:
   ```bash
   mysql -u root -p < sql/habit_tracker_schema.sql
   ```
   Or manually run the SQL file in phpMyAdmin

3. Verify tables are created:
   ```sql
   USE habit_tracker;
   SHOW TABLES;
   ```

### Step 2: File Setup

1. Place all files in your web server's directory (e.g., `/opt/lampp/htdocs/jira/`)
2. Ensure proper file permissions:
   ```bash
   chmod -R 755 /opt/lampp/htdocs/jira/
   ```

### Step 3: Configuration

The application currently uses localStorage for demo purposes. To connect to the database:

1. Create a PHP backend API (recommended structure):
   ```
   api/
   ├── config/
   │   └── database.php       # Database connection
   ├── auth/
   │   ├── login.php
   │   └── signup.php
   ├── habits/
   │   ├── create.php
   │   ├── update.php
   │   ├── delete.php
   │   └── list.php
   └── completions/
       └── update.php
   ```

2. Update `assets/js/script.js` to make API calls instead of localStorage

### Step 4: Access the Application

1. Start your web server (XAMPP/LAMP)
2. Visit: `http://localhost/jira/index.html`
3. Create an account or use demo credentials:
   - Email: `demo@habittracker.com`
   - Password: `password123`

## Database Configuration

Update your database credentials in a `config.php` file:

```php
<?php
define('DB_HOST', 'localhost');
define('DB_NAME', 'habit_tracker');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');
```

## API Endpoints (To Be Implemented)

The application will need these API endpoints:

### Authentication
- `POST /api/auth/signup.php` - User registration
- `POST /api/auth/login.php` - User login
- `POST /api/auth/logout.php` - User logout

### Habits
- `GET /api/habits/list.php` - Get all user habits
- `POST /api/habits/create.php` - Create new habit
- `PUT /api/habits/update.php` - Update habit
- `DELETE /api/habits/delete.php` - Delete/archive habit

### Completions
- `GET /api/completions/get.php?date=YYYY-MM-DD` - Get completions for date
- `POST /api/completions/update.php` - Mark habit complete/missed
- `GET /api/completions/history.php` - Get completion history

### Profile
- `GET /api/profile/get.php` - Get user profile
- `PUT /api/profile/update.php` - Update profile
- `POST /api/profile/avatar.php` - Upload avatar

### Stats
- `GET /api/stats/dashboard.php` - Get dashboard statistics
- `GET /api/stats/calendar.php` - Get calendar data

## Technologies Used

- **Frontend**:
  - HTML5
  - CSS3 (Custom Properties, Grid, Flexbox)
  - Vanilla JavaScript (ES6+)
  - Chart.js (for data visualization)

- **Backend** (To be implemented):
  - PHP 7.4+
  - MySQL/MariaDB
  - PDO for database access

- **Fonts**:
  - Manrope (body text)
  - Space Grotesk (headings)

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

## Security Considerations

⚠️ **Important**: Before deploying to production:

1. Implement proper password hashing (bcrypt/argon2)
2. Use prepared statements for all database queries
3. Implement CSRF protection
4. Add rate limiting for API endpoints
5. Enable HTTPS
6. Sanitize all user inputs
7. Implement session management
8. Add SQL injection prevention
9. Validate file uploads strictly

## Future Enhancements

- [ ] Backend API implementation
- [ ] Email notifications
- [ ] Weekly reports
- [ ] Social features (share achievements)
- [ ] Mobile app (React Native)
- [ ] Habit templates
- [ ] Reminder system
- [ ] Data analytics and insights
- [ ] Import/export improvements
- [ ] Multi-language support

## License

This project is for educational purposes.

## Support

For issues or questions, please check the code comments or database schema documentation.

---

**Built with ❤️ for building better habits**

## Quick Git Workflow

1. Clone the repository (first time only):
   - https://github.com/SenpaiNeedsHelp/HIRA_KO_JIRA
2. Pull latest changes before starting work:
   - git pull origin main
3. Stage your changes:
   - git add .
4. Commit with a clear message:
   - git commit -m "Add navbar component"
5. Push to GitHub:
   - git push origin main
