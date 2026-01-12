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
| express | Web server framework |
| express-session | Session management for authentication |
| connect-flash | Flash messages for user feedback |
| bcrypt | Secure password hashing |
| ejs | Server-side template engine |
| sqlite3 | SQLite database driver |
| body-parser | Request body parsing middleware |

## Project Structure

```
├── index.js                 # Main entry point
├── package.json             # Dependencies
├── db_schema.sql            # Database schema
├── utils/
│   └── helpers.js           # Shared utility functions
├── routes/
│   ├── login.js             # Authentication routes
│   ├── organiser.js         # Organiser dashboard routes
│   └── attendee.js          # Attendee public routes
├── views/
│   ├── home.ejs             # Main home page
│   ├── login.ejs            # Login/register page
│   ├── organiser_home.ejs   # Organiser dashboard
│   ├── site_settings.ejs    # Site settings form
│   ├── edit_event.ejs       # Event edit form
│   ├── view_bookings.ejs    # Booking summary
│   ├── view_waitlist.ejs    # Waitlist management [EXT]
│   ├── attendee_home.ejs    # Attendee event listing
│   ├── attendee_event.ejs   # Event details & booking
│   └── booking_confirmation.ejs
└── public/
    ├── main.css             # Global styles
    ├── home.css
    ├── login.css
    ├── organiser.css
    └── attendee.css
```

## Extension Features

1. **Category Filtering** - Events can be categorised and filtered by category on the attendee page
2. **Authentication** - Organiser login system with bcrypt password hashing
3. **Email Capture** - Optional email field for booking confirmations
4. **Dietary Notes** - Capture dietary requirements with bookings
5. **Waitlist System** - Queue for sold-out events with position tracking and notification management

## Security Notes

- All passwords are hashed using bcrypt before storage
- Session-based authentication protects organiser routes
- Input sanitization helps prevent XSS attacks
