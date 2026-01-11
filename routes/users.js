/**
 * users.js
 * User Management Routes (Template File)
 * Basic user CRUD operations from original template
 */
// From given template
const express = require("express");
const router = express.Router();

/**
 * GET: List All Users
 * Purpose: Display all users as JSON
 * Input: None
 * Output: JSON array of user records
 */
router.get("/list-users", (req, res, next) => {
    const query = "SELECT * FROM users";

    global.db.all(query, function(err, rows) {
        if (err) {
            next(err);
        } else {
            res.json(rows);
        }
    });
});

/**
 * GET: Add User Form
 * Purpose: Display form for creating a user record
 * Input: None
 * Output: Renders add_user.ejs template
 */
router.get("/add-user", (req, res) => {
    res.render("add_user.ejs");
});

/**
 * POST: Create User
 * Purpose: Add a new user to the database
 * Input: user_name from form body
 * Output: Confirmation message with new record ID
 */
router.post("/add-user", (req, res, next) => {
    const query = "INSERT INTO users (user_name) VALUES(?)";
    const params = [req.body.user_name];
    
    global.db.run(query, params, function(err) {
        if (err) {
            next(err);
        } else {
            res.send(`New user created with ID: ${this.lastID}`);
        }
    });
});

module.exports = router;
