/**
 * login.js
 * Authentication Routes for Flavor Academy
 * Handles chef login, registration, and logout
 */
// START
const express = require('express');
const router = express.Router();

// =============================================================================
// GET: Login Page
// Purpose: Display login and registration forms
// Input: Optional message query parameter for success/error display
// Output: Renders login page
// =============================================================================
router.get('/', (req, res) => {
    const message = req.query.message || null;
    res.render('login', { message });
});

// =============================================================================
// POST: Process Login
// Purpose: Authenticate chef and create session
// Input: Username and password from form body
// Output: Redirects to dashboard on success, error message on failure
// =============================================================================
router.post('/', (req, res) => {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
        return res.send('Username and password are required. <a href="/login">Try again</a>');
    }

    // Check credentials against database
    global.db.get(
        'SELECT * FROM organisers WHERE username = ? AND password = ?',
        [username, password],
        (err, user) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Database error. <a href="/login">Try again</a>');
            }
            
            if (user) {
                // Login successful: create session
                req.session.authenticated = true;
                req.session.username = username;
                res.redirect('/organiser');
            } else {
                // Login failed
                res.send('Incorrect username or password. <a href="/login">Try again</a>');
            }
        }
    );
});

// =============================================================================
// POST: Register New Chef
// Purpose: Create new organiser account
// Input: Username, password, and confirm_password from form body
// Output: Redirects to login with success message, or shows error
// =============================================================================
router.post('/register', (req, res) => {
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
        return res.send('Password must be at least 6 characters long. <a href="/login">Try again</a>');
    }

    // Check if username already exists
    global.db.get(
        'SELECT * FROM organisers WHERE username = ?',
        [username],
        (err, existingUser) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Database error. <a href="/login">Try again</a>');
            }
            
            if (existingUser) {
                return res.send('Username already exists. Please choose a different username. <a href="/login">Try again</a>');
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
        }
    );
});
// END

module.exports = router;
