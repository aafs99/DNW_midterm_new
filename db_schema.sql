-- db_schema.sql
-- flavour Academy - Restaurant Workshop Manager
-- Database schema with indexes for performance

-- Enable foreign key constraints
PRAGMA foreign_keys=ON;

BEGIN TRANSACTION;

-- ============================================================================
-- SETTINGS TABLE
-- Stores site configuration (name and description)
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY,
    site_name TEXT NOT NULL,
    site_description TEXT NOT NULL
);

-- Default site settings
INSERT INTO settings (id, site_name, site_description)
VALUES (1, 'Flavour Academy', 'Hands on cooking workshops for food lovers of all skill levels');

-- ============================================================================
-- CATEGORIES TABLE (EXTENSION)
-- Workshop categories for filtering and organization
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

-- Default workshop categories
INSERT INTO categories (name) VALUES ('Italian Cuisine');
INSERT INTO categories (name) VALUES ('Baking & Pastry');
INSERT INTO categories (name) VALUES ('Knife Skills');
INSERT INTO categories (name) VALUES ('Asian Fusion');
INSERT INTO categories (name) VALUES ('Healthy Cooking');
INSERT INTO categories (name) VALUES ('BBQ & Grilling');

-- ============================================================================
-- EVENTS TABLE (Workshops)
-- Stores workshop information
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
-- TICKETS TABLE (Seat Types)
-- Stores seat types and pricing for each workshop
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
-- BOOKINGS TABLE (Reservations)
-- Stores guest reservations for workshops
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
-- ORGANISERS TABLE (Chef Accounts)
-- Stores chef login credentials
-- Note: Passwords are hashed using bcrypt
-- ============================================================================
CREATE TABLE IF NOT EXISTS organisers (
    organiser_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'organiser',
    created_at TEXT NOT NULL
);

-- Default admin account
-- Password: admin123 (will be hashed on first login or via setup script)
-- For development, using plain text. In production, run password hash script.
INSERT INTO organisers (username, password, email, role, created_at)
VALUES ('admin', 'admin123', 'admin@flavouracademy.com', 'admin', datetime('now'));

-- ============================================================================
-- PERFORMANCE INDEXES
-- Speed up common queries
-- ============================================================================

-- Index for filtering events by status (published/draft)
CREATE INDEX idx_events_status ON events(status);

-- Index for ordering events by date
CREATE INDEX idx_events_date ON events(event_date);

-- Index for looking up bookings by event
CREATE INDEX idx_bookings_event ON bookings(event_id);

-- Index for looking up tickets by event
CREATE INDEX idx_tickets_event ON tickets(event_id);

-- Index for category lookups
CREATE INDEX idx_events_category ON events(category_id);

-- Index for organiser username lookup (login)
CREATE INDEX idx_organisers_username ON organisers(username);

-- ============================================================================
-- WAITLIST TABLE (EXTENSION)
-- Queue for attendees when workshops are fully booked
-- Demonstrates: FIFO queue management, complex availability logic
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

-- Index for waitlist lookups
CREATE INDEX idx_waitlist_event ON waitlist(event_id);
CREATE INDEX idx_waitlist_status ON waitlist(status);

COMMIT;
