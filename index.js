/**
 * index.js
 * Event Manager Application: Flavour Academy
 * Main entry point
 */

// =============================================================================
// MODULE IMPORTS
// =============================================================================
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const bodyParser = require('body-parser');

// =============================================================================
// APPLICATION SETUP
// =============================================================================
const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));

// =============================================================================
// SESSION CONFIGURATION
// Manage user authentication sessions
// Inputs HTTP requests
// Outputs Session data attached to req.session
// =============================================================================
app.use(session({
    secret: 'flavour-academy-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 3600000
    }
}));

// =============================================================================
// FLASH MESSAGES
// Display one-time messages across redirects
// Inputs Messages set via req.flash()
// Outputs Messages available in res.locals for templates
// =============================================================================
app.use(flash());

app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

// =============================================================================
// DATABASE CONNECTION
// Create single SQLite connection shared across all routes
// Inputs Database file path
// Outputs global.db available to all route modules
// =============================================================================
const sqlite3 = require('sqlite3').verbose();
global.db = new sqlite3.Database('./database.db', function(err) {
    if (err) {
        console.error('Database connection failed:', err);
        process.exit(1);
    } else {
        console.log('Database connected');
        global.db.run("PRAGMA foreign_keys=ON");
    }
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /
 * Display main home page with navigation links
 * Inputs None
 * Outputs Renders home.ejs with links to organiser and attendee pages
 */
app.get('/', (req, res) => {
    res.render('home');
});

/**
 * GET /logout
 * End user session and redirect to home
 * Inputs req.session
 * Outputs Destroys session, redirects to /
 */
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('Session destroy error:', err);
        res.redirect('/');
    });
});

// =============================================================================
// ROUTE MODULES
// All routes use global.db for database access (single connection)
// =============================================================================

const loginRoutes = require('./routes/login');
app.use('/login', loginRoutes);

const organiserRoutes = require('./routes/organiser');
app.use('/organiser', organiserRoutes);

const attendeeRoutes = require('./routes/attendee');
app.use('/attendee', attendeeRoutes);

// Users routes - from original template
// Not used in main application (registration via /login/register)
// Kept for template compliance
const usersRoutes = require('./routes/users');
app.use('/users', usersRoutes);

// =============================================================================
// ERROR HANDLERS
// =============================================================================

/**
 * 404 Handler
 * Handle requests to undefined routes
 */
app.use((req, res) => {
    res.status(404).send(`
        <h1>404 - Page Not Found</h1>
        <p>The page you requested does not exist.</p>
        <a href="/">Return to Home</a>
    `);
});

/**
 * Error Handler
 * Handle server errors
 */
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).send(`
        <h1>500 - Server Error</h1>
        <p>Something went wrong.</p>
        <a href="/">Return to Home</a>
    `);
});

// =============================================================================
// START SERVER
// =============================================================================
app.listen(port, () => {
    console.log(`Flavour Academy running at http://localhost:${port}`);
});