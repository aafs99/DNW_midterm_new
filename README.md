# Flavor Academy

Restaurant Workshop Manager: A web application for managing cooking workshops and class reservations.

## Setup Instructions

1. Install dependencies:
```bash
npm install
```

2. Build the database:
```bash
npm run build-db
```
For Windows users:
```bash
npm run build-db-win
```

3. Start the server:
```bash
npm run start
```

4. Open your browser and navigate to:
   * http://localhost:3000 (Home)
   * http://localhost:3000/attendee (Attendee Home Page)
   * http://localhost:3000/login (Chef Login)

## Default Chef Login

Username: `admin`
Password: `admin123`

You can also register new chef accounts via the login page.

## Features

### Base Features
* Organiser Home Page for managing cooking workshops
* Attendee Home Page for browsing and booking workshops
* Two seat types: Standard and Student/Senior pricing
* Workshop publishing workflow (draft to published)
* Site settings management
* Session based authentication

### Extension Features
* Workshop Categories (Italian, Baking, Asian Fusion, etc.)
* Category filtering on guest portal
* Email capture during reservation
* Dietary requirements and allergy notes
* Enhanced reservation summary with dietary alerts

## Technologies Used

* Node.js and Express.js (Server)
* SQLite3 (Database)
* EJS Templates (Views)
* Bootstrap 5 (Styling)
* express-session (Authentication)
* connect-flash (Flash Messages)

## Additional Libraries

| Library | Purpose |
|---------|---------|
| express | Web server framework |
| ejs | Template rendering |
| sqlite3 | Database driver |
| express-session | Session management for login |
| connect-flash | Success/error flash messages |
| body-parser | Form data parsing |

## Project Structure

```
flavour-academy/
├── index.js              # Main application entry point
├── package.json          # Dependencies and scripts
├── db_schema.sql         # Database schema
├── database.db           # SQLite database (generated)
├── routes/
│   ├── organiser.js      # Chef dashboard routes
│   ├── attendee.js       # Guest portal routes
│   ├── login.js          # Authentication routes
│   └── users.js          # User routes (template)
├── views/
│   ├── home.ejs                # Landing page
│   ├── login.ejs               # Chef login page
│   ├── dashboard.ejs      # Chef dashboard
│   ├── workshop_form.ejs          # Workshop editor
│   ├── configure.ejs       # Academy settings
│   ├── reservations.ejs       # Reservation summary
│   ├── catalog.ejs       # Guest workshop listing
│   ├── workshop_detail.ejs      # Workshop detail/booking
│   ├── receipt.ejs # Reservation confirmation
│   └── add_user.ejs            # Add user (template)
└── public/
    ├── main.css          # Global styles
    ├── home.css          # Landing page styles
    ├── organiser.css     # Chef dashboard styles
    ├── attendee.css      # Guest portal styles
    └── login.css         # Login page styles
```

## Database Schema

### Tables
* `settings` : Site name and description
* `categories` : Workshop categories (extension)
* `events` : Workshop details
* `tickets` : Seat types and pricing
* `bookings` : Guest reservations
* `organisers` : Chef login credentials

## Extension Implementation

The extension adds practical features for a cooking workshop context:

1. **Categories**: Workshops can be assigned to categories like Italian Cuisine, Baking, or Knife Skills. Guests can filter workshops by category.

2. **Email Capture**: Guests provide their email during booking for confirmation purposes.

3. **Dietary Notes**: Guests can specify allergies or dietary requirements (vegetarian, gluten free, nut allergy, etc.). These are displayed to the chef in the reservation summary.

These features demonstrate additional database design, server side filtering, and form handling beyond the base requirements.
