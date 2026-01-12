# Event Manager - Flavour Academy

A web application for managing cooking workshop events.

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the database:
   ```bash
   npm run build-db
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
| express | Web server framework |
| express-session | Session management |
| connect-flash | Flash messages |
| bcrypt | Password hashing |
| ejs | Template engine |
| sqlite3 | Database driver |
| body-parser | Request body parsing |

## Project Structure

```
├── index.js                 # Main entry point
├── package.json             # Dependencies
├── db_schema.sql            # Database schema
├── routes/
│   ├── login.js             # Authentication routes
│   ├── organiser.js         # Organiser routes
│   └── attendee.js          # Attendee routes
├── views/
│   ├── home.ejs             # Main home page
│   ├── login.ejs            # Login page
│   ├── organiser_home.ejs   # Organiser dashboard
│   ├── site_settings.ejs    # Site settings
│   ├── edit_event.ejs       # Event edit form
│   ├── view_bookings.ejs    # Booking summary
│   ├── view_waitlist.ejs    # Waitlist management [EXT]
│   ├── attendee_home.ejs    # Attendee event list
│   ├── attendee_event.ejs   # Event details & booking
│   └── booking_confirmation.ejs
└── public/
    ├── main.css
    ├── home.css
    ├── login.css
    ├── organiser.css
    └── attendee.css
```

## Extension Features

1. **Category Filtering** - Events can be filtered by category
2. **Authentication** - Organiser login with bcrypt password hashing
3. **Email Capture** - Optional email field for bookings
4. **Dietary Notes** - Capture dietary requirements
5. **Waitlist System** - Queue for sold-out events with position tracking