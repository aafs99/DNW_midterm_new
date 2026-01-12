/**
 * routes/login.js
 * Authentication Routes - Login and Registration
 * 
 * Purpose: Handle organiser authentication with bcrypt password hashing
 * Database: Uses global.db (single connection from index.js)
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { isValidEmail } = require('../utils/helpers');

const SALT_ROUNDS = 10;

// =============================================================================
// HELPER FUNCTIONS
// Note: Common helpers imported from utils/helpers.js
// =============================================================================

/**
 * hashPassword
 * Purpose: Create bcrypt hash of plain text password
 * Input: password (string)
 * Output: Promise<string> - bcrypt hash
 */
async function hashPassword(password) {
    return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * verifyPassword
 * Purpose: Compare password against stored bcrypt hash
 * Input: password (string), storedHash (string)
 * Output: Promise<boolean>
 */
async function verifyPassword(password, storedHash) {
    return await bcrypt.compare(password, storedHash);
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /login
 * Purpose: Display login and registration forms
 * Input: req.query.message (optional)
 * Output: Renders login.ejs with settings
 * Database: SELECT from settings table
 */
router.get('/', (req, res) => {
    const message = req.query.message || null;
    global.db.get('SELECT * FROM settings WHERE id = 1', [], (err, settings) => {
        if (err || !settings) {
            settings = { site_name: 'Event Manager', site_description: '' };
        }
        res.render('login', { message, settings });
    });
});

/**
 * POST /login
 * Purpose: Authenticate organiser credentials
 * Input: req.body.username, req.body.password
 * Output: Redirects to /organiser on success, error message on failure
 * Database: SELECT from organisers, compare password with bcrypt
 */
router.post('/', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.send('Username and password are required. <a href="/login">Try again</a>');
        }

        global.db.get(
            'SELECT * FROM organisers WHERE username = ?',
            [username],
            async (err, user) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).send('Database error. <a href="/login">Try again</a>');
                }

                if (!user) {
                    return res.send('Invalid username or password. <a href="/login">Try again</a>');
                }

                const isValid = await verifyPassword(password, user.password);

                if (isValid) {
                    req.session.authenticated = true;
                    req.session.username = user.username;
                    req.session.userId = user.organiser_id;
                    req.session.role = user.role || 'organiser';
                    res.redirect('/organiser');
                } else {
                    res.send('Invalid username or password. <a href="/login">Try again</a>');
                }
            }
        );
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).send('Server error. <a href="/login">Try again</a>');
    }
});

/**
 * POST /login/register
 * Purpose: Create new organiser account with hashed password
 * Input: req.body.username, req.body.password, req.body.confirm_password, req.body.email
 * Output: Redirects to /login with success message
 * Database: INSERT into organisers with bcrypt hashed password
 */
router.post('/register', async (req, res) => {
    try {
        const { username, password, confirm_password, email } = req.body;

        if (!username || !password || !confirm_password) {
            return res.send('All fields are required. <a href="/login">Try again</a>');
        }

        if (username.length < 3 || username.length > 50) {
            return res.send('Username must be 3-50 characters. <a href="/login">Try again</a>');
        }

        if (password !== confirm_password) {
            return res.send('Passwords do not match. <a href="/login">Try again</a>');
        }

        if (password.length < 6) {
            return res.send('Password must be at least 6 characters. <a href="/login">Try again</a>');
        }

        if (email && !isValidEmail(email)) {
            return res.send('Invalid email format. <a href="/login">Try again</a>');
        }

        global.db.get(
            'SELECT * FROM organisers WHERE username = ?',
            [username],
            async (err, existingUser) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).send('Database error. <a href="/login">Try again</a>');
                }

                if (existingUser) {
                    return res.send('Username already exists. <a href="/login">Try again</a>');
                }

                const hashedPassword = await hashPassword(password);
                const now = new Date().toISOString();

                global.db.run(
                    'INSERT INTO organisers (username, password, email, created_at) VALUES (?, ?, ?, ?)',
                    [username, hashedPassword, email || null, now],
                    function(insertErr) {
                        if (insertErr) {
                            console.error('Insert error:', insertErr);
                            return res.status(500).send('Failed to create account. <a href="/login">Try again</a>');
                        }
                        res.redirect('/login?message=Account created successfully! Please login.');
                    }
                );
            }
        );
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).send('Server error. <a href="/login">Try again</a>');
    }
});

module.exports = router;