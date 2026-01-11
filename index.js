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

// Session for for login
app.use(session({
    secret: 'flavour-academy-secret-key',
    resave: false,
    saveUninitialized: false
}));

// Flash messages middleware
app.use(flash());

// incl flash messages available to all templates
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

// set up for SQLite
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

// home page ejs
app.get('/', (req, res) => {
    res.render('home');
});

// login routes
const loginRoutes = require('./routes/login');
app.use('/login', loginRoutes);

// logout route
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// organiser routes
const organiserRoutes = require('./routes/organiser');
app.use('/organiser', organiserRoutes);

// attendee routes
const attendeeRoutes = require('./routes/attendee');
app.use('/attendee', attendeeRoutes);

// !TDL remove? users routes
const usersRoutes = require('./routes/users');
app.use('/users', usersRoutes);
app.listen(port, () => {
    console.log(`x listening on port ${port}`);
});
