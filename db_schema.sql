-- db_schema.sql
-- Event Manager Application:Flavour Academy
-- DNW Midterm Coursework

PRAGMA foreign_keys=ON;

BEGIN TRANSACTION;

-- ============================================================================
-- SETTINGS TABLE
-- Stores site configuration ie name and description
-- Used by All pages to display site branding
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY,
    site_name TEXT NOT NULL,
    site_description TEXT NOT NULL
);

INSERT INTO settings (id, site_name, site_description)
VALUES (1, 'Flavour Academy', 'Hands-on cooking workshops for food lovers of all skill levels');

-- ============================================================================
-- CATEGORIES TABLE [EXTENSION]
-- Event categories for filtering
-- Used by Attendee home page filter, event edit form
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

INSERT INTO categories (name) VALUES ('Italian Cuisine');
INSERT INTO categories (name) VALUES ('Baking & Pastry');
INSERT INTO categories (name) VALUES ('Knife Skills');
INSERT INTO categories (name) VALUES ('Asian Fusion');
INSERT INTO categories (name) VALUES ('Healthy Cooking');
INSERT INTO categories (name) VALUES ('BBQ & Grilling');

-- ============================================================================
-- EVENTS TABLE
-- Stores event information
-- Used by Organiser dashboard, attendee browsing, booking system
-- ============================================================================
CREATE TABLE IF NOT EXISTS events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    event_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    published_at TEXT,
    status TEXT DEFAULT 'draft',
    category_id INTEGER,
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

-- ============================================================================
-- TICKETS TABLE
-- Stores ticket types and pricing for each event
-- Used by Event edit form, booking form, availability calculation
-- ============================================================================
CREATE TABLE IF NOT EXISTS tickets (
    ticket_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
);

-- ============================================================================
-- BOOKINGS TABLE
-- Stores attendee reservations
-- Used by Booking process, reservation view, availability calculation
-- [EXTENSION]Fields attendee_email and dietary_notes 
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookings (
    booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    attendee_name TEXT NOT NULL,
    attendee_email TEXT,
    ticket_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    booking_date TEXT NOT NULL,
    dietary_notes TEXT,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
);

-- ============================================================================
-- ORGANISERS TABLE [EXTENSION]
-- Stores organiser login credentials for authentication
-- Used by Login system, session management
-- New registrations use bcrypt hashing, default admin uses plain text
-- ============================================================================
CREATE TABLE IF NOT EXISTS organisers (
    organiser_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'organiser',
    created_at TEXT NOT NULL
);

-- Default admin account (plain text for simplicity)
INSERT INTO organisers (username, password, email, role, created_at)
VALUES ('admin', 'admin123', 'admin@example.com', 'admin', datetime('now'));

-- ============================================================================
-- WAITLIST TABLE [EXTENSION]
-- Queue for attendees when events are fully booked
-- Used by Waitlist joining (attendee), waitlist management (organiser)
-- ============================================================================
CREATE TABLE IF NOT EXISTS waitlist (
    waitlist_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    attendee_name TEXT NOT NULL,
    attendee_email TEXT NOT NULL,
    ticket_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    requested_at TEXT NOT NULL,
    status TEXT DEFAULT 'waiting',
    notified_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES
-- Improve query performance on frequently accessed columns
-- ============================================================================
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_category ON events(category_id);
CREATE INDEX idx_bookings_event ON bookings(event_id);
CREATE INDEX idx_tickets_event ON tickets(event_id);
CREATE INDEX idx_organisers_username ON organisers(username);
CREATE INDEX idx_waitlist_event ON waitlist(event_id);
CREATE INDEX idx_waitlist_status ON waitlist(status);

COMMIT;