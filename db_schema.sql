-- db_schema.sql
-- Midterm: Flavour Academy, a Restaurant Workshop Manager
-- Database for restaurant workshop booking system

-- Enable foreign key constraints
PRAGMA foreign_keys=ON;

BEGIN TRANSACTION;

-- ============================================================================
-- SETTINGS TABLE
-- Stores name and description
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY,
    site_name TEXT NOT NULL,
    site_description TEXT NOT NULL
);

-- Default site settings for Flavour Academy
INSERT INTO settings (id, site_name, site_description)
VALUES (1, 'Flavour Academy', 'Hands-on cooking workshops for food lovers of all skill levels');

-- ============================================================================
-- CATEGORIES TABLE (!EXTENSION)
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
-- Stores workshop/event information
-- Inputs: title, description, date, timestamps, status
-- Outputs: Used by organiser and attendee pages
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
-- Stores seat/ ticket types and pricing for each workshop
-- Types: "full" = Standard seats, "concession" = Student/Senior seats
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
-- BOOKINGS TABLE (Reservations )
-- Stores guest reservations for workshops
-- Inputs: event_id, guest name, email, ticket type, quantity
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

COMMIT;
