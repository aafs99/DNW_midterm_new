/**
 * index.js
 * Main entry point for Restaurant Workshop Manager App
 */

// Set up the required modules
const express = require('express');
const session = require('express-session');      // authentication
const flash = require('connect-flash');          // flash messages

const app = express();
const port = 3000;

var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));

// Session for login
app.use(session({
    secret: 'flavour-academy-secret-key',
    resave: false,
    saveUninitialized: false
}));

// Flash messages middleware
app.use(flash());

// Include flash messages available to all templates
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

// Set up SQLite
const sqlite3 = require('sqlite3').verbose();
global.db = new sqlite3.Database('./database.db', function(err) {
    if (err) {
        console.error(err);
        process.exit(1);
    } else {
        console.log("Database connected");
        global.db.run("PRAGMA foreign_keys=ON");
    }
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET: Home Page
 * Purpose: Display main landing page with navigation options
 * Input: None
 * Output: Renders home.ejs template
 */
app.get('/', (req, res) => {
    res.render('home');
});

/**
 * POST: Register New Chef Account
 * Purpose: Create new organiser account in database
 * Input: username, password, confirm_password from form body
 * Output: Redirects to login with success message or shows error
 */
app.post('/register', (req, res) => {
    const { username, password, confirm_password } = req.body;

    // Validate all fields present
    if (!username || !password || !confirm_password) {
        return res.send('All fields are required. <a href="/login">Try again</a>');
    }
    
    // Validate passwords match
    if (password !== confirm_password) {
        return res.send('Passwords do not match. <a href="/login">Try again</a>');
    }

    // Validate password length
    if (password.length < 6) {
        return res.send('Password must be at least 6 characters. <a href="/login">Try again</a>');
    }

    // Check if username already exists
    global.db.get('SELECT * FROM organisers WHERE username = ?', [username], (err, existingUser) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error. <a href="/login">Try again</a>');
        }
        
        if (existingUser) {
            return res.send('Username already exists. <a href="/login">Try again</a>');
        }

        // Create new chef account
        const now = new Date().toISOString();
        global.db.run(
            'INSERT INTO organisers (username, password, created_at) VALUES (?, ?, ?)',
            [username, password, now],
            function(err) {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Failed to create account. <a href="/login">Try again</a>');
                }
                // Redirect to login with success message
                res.redirect('/login?message=Account created successfully! Please login.');
            }
        );
    });
});

// Login routes
const loginRoutes = require('./routes/login');
app.use('/login', loginRoutes);

/**
 * GET: Logout
 * Purpose: Destroy session and redirect to home
 * Input: None
 * Output: Redirects to home page
 */
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Organiser routes (Chef Dashboard)
const organiserRoutes = require('./routes/organiser');
app.use('/organiser', organiserRoutes);

// Attendee routes (Guest Portal)
const attendeeRoutes = require('./routes/attendee');
app.use('/attendee', attendeeRoutes);

// Users routes (from template, kept for compatibility)
const usersRoutes = require('./routes/users');
app.use('/users', usersRoutes);

// Start server
app.listen(port, () => {
    console.log(`Flavour Academy running on port ${port}`);
});
