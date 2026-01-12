# Event Manager - Flavour Academy

A Node.js web application for managing events, built for the DNW Midterm Coursework.

## Project Structure

```
├── index.js                 # Main entry point, server setup
├── package.json             # Dependencies and scripts
├── db_schema.sql            # Database schema with sample data
├── database.db              # SQLite database (generated)
│
├── utils/
│   └── helpers.js           # Shared utility functions
│
├── routes/
│   ├── login.js             # Authentication routes
│   ├── organiser.js         # Organiser dashboard routes
│   └── attendee.js          # Attendee public routes
│
├── views/
│   ├── home.ejs             # Main landing page
│   ├── login.ejs            # Login/registration page
│   ├── organiser_home.ejs   # Organiser dashboard
│   ├── edit_event.ejs       # Event edit form
│   ├── site_settings.ejs    # Site settings form
│   ├── view_bookings.ejs    # All bookings view
│   ├── view_waitlist.ejs    # Waitlist management
│   ├── attendee_home.ejs    # Public event listing
│   ├── attendee_event.ejs   # Event details and booking
│   └── booking_confirmation.ejs
│
└── public/
    ├── main.css             # Global styles
    ├── home.css             # Home page styles
    ├── login.css            # Login page styles
    ├── organiser.css        # Organiser pages styles
    └── attendee.css         # Attendee pages styles
```

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the database:
   ```bash
   npm run build-db
   ```
   On Windows:
   ```bash
   npm run build-db-win
   ```

3. Start the server:
   ```bash
   npm run start
   ```

4. Open browser: http://localhost:3000

## Default Login

- **Username:** admin
- **Password:** admin123

## Additional Libraries

| Library | Purpose |
|---------|---------|
| express | Web framework for Node.js |
| ejs | Embedded JavaScript templating |
| sqlite3 | SQLite database driver |
| body-parser | Parse incoming request bodies |
| express-session | Session management for authentication |
| connect-flash | Flash messages for user feedback |
| bcrypt | Password hashing for new registrations |
| Bootstrap 5 (CDN) | CSS framework for styling |

## Extension Features

1. **Authentication System** - Organiser login/registration with session management. New accounts use bcrypt password hashing.

2. **Category Filtering** - Events can be assigned categories. Attendees can filter the event list by category.

3. **Waitlist System** - When events are sold out, attendees can join a waitlist with position tracking. Organisers can view and manage the waitlist.

4. **Email Capture** - Optional email field when booking tickets.

5. **Dietary Notes** - Attendees can add dietary requirements when booking.