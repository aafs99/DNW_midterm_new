/**
 * organiser.js
 * Chef Dashboard Routes for Flavor Academy
 * Handles workshop creation, editing, publishing, deletion, and settings
 */
// START
const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

/**
 * Authentication Middleware
 * Purpose: Protect all organiser routes from unauthorized access
 * Input: Session data from request
 * Output: Redirects to login if not authenticated, otherwise continues
 */
router.use((req, res, next) => {
    if (req.session.authenticated) {
        next();
    } else {
        res.redirect('/login');
    }
});

/**
 * Helper Function: formatDate
 * Purpose: Convert ISO timestamp to human readable format
 * Input: ISO date string
 * Output: Formatted date string (e.g., "15 Jan 2025, 14:30")
 */
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Helper Function: addRemainingTicketInfo
 * Purpose: Calculate remaining seats for each workshop
 * Input: Array of event objects
 * Output: Events with remainingTickets property added
 */
function addRemainingTicketInfo(events) {
    return Promise.all(events.map(event => {
        return new Promise(resolve => {
            // Get all ticket types for this event
            db.all(
                `SELECT type, quantity FROM tickets WHERE event_id = ?`,
                [event.event_id],
                (err, tickets) => {
                    if (err) return resolve();

                    // Get sum of booked tickets by type
                    db.all(
                        `SELECT ticket_type, SUM(quantity) as booked FROM bookings WHERE event_id = ? GROUP BY ticket_type`,
                        [event.event_id],
                        (err2, bookings) => {
                            if (err2) return resolve();

                            // Calculate remaining for each ticket type
                            const remaining = {};
                            tickets.forEach(ticket => {
                                const booked = bookings.find(b => b.ticket_type === ticket.type);
                                const remainingQty = ticket.quantity - (booked ? booked.booked : 0);
                                remaining[ticket.type] = remainingQty;
                            });

                            event.remainingTickets = remaining;
                            resolve();
                        }
                    );
                }
            );
        });
    }));
}

// =============================================================================
// GET: Chef Dashboard (Home Page)
// Purpose: Display all workshops (published and drafts) with seat availability
// Input: None (uses session for auth)
// Output: Renders chef dashboard with workshop lists and site settings
// =============================================================================
router.get('/', (req, res) => {
    const siteQuery = 'SELECT * FROM settings WHERE id = 1';
    const publishedQuery = "SELECT * FROM events WHERE status = 'published' ORDER BY event_date ASC";
    const draftQuery = "SELECT * FROM events WHERE status = 'draft' ORDER BY created_at DESC";

    // Get site settings
    db.get(siteQuery, [], (err, settings) => {
        if (err) return res.status(500).send('Settings error');

        // Get published workshops
        db.all(publishedQuery, [], (err2, publishedEvents) => {
            if (err2) return res.status(500).send('Workshop error');

            // Get draft workshops
            db.all(draftQuery, [], async (err3, draftEvents) => {
                if (err3) return res.status(500).send('Draft error');

                // Combine all events for ticket info calculation
                const allEvents = [...publishedEvents, ...draftEvents];

                // Add remaining seat counts to each workshop
                await addRemainingTicketInfo(allEvents);

                // Format timestamps for display
                publishedEvents.forEach(event => {
                    event.created_at_formatted = formatDate(event.created_at);
                    event.published_at_formatted = formatDate(event.published_at);
                    event.updated_at_formatted = formatDate(event.updated_at);
                });

                draftEvents.forEach(event => {
                    event.created_at_formatted = formatDate(event.created_at);
                    event.updated_at_formatted = formatDate(event.updated_at);
                });

                // Render the chef dashboard
                res.render('dashboard', {
                    settings,
                    publishedEvents,
                    draftEvents
                });
            });
        });
    });
});
// END

// =============================================================================
// POST: Delete Workshop
// Purpose: Remove a workshop and its associated tickets/bookings from database
// Input: Workshop ID from URL params
// Output: Redirects to dashboard after deletion
// =============================================================================
router.post('/delete/:id', (req, res) => {
    const eventId = req.params.id;
    
    // Delete the workshop (CASCADE will remove tickets and bookings)
    db.run('DELETE FROM events WHERE event_id = ?', [eventId], function(err) {
        if (err) return res.status(500).send('Delete failed');
        res.redirect('/organiser');
    });
});

// =============================================================================
// POST: Publish Workshop
// Purpose: Change workshop status from draft to published
// Input: Workshop ID from URL params
// Output: Updates status and timestamp, redirects to dashboard
// =============================================================================
router.post('/publish/:id', (req, res) => {
    const eventId = req.params.id;
    const publishedAt = new Date().toISOString();
    
    // Update status to published and set publication timestamp
    db.run(
        "UPDATE events SET status = 'published', published_at = ? WHERE event_id = ?",
        [publishedAt, eventId],
        function(err) {
            if (err) return res.status(500).send('Publish failed');
            res.redirect('/organiser');
        }
    );
});

// =============================================================================
// GET: Create New Workshop
// Purpose: Create a new draft workshop and redirect to edit page
// Input: None
// Output: Creates workshop record, redirects to edit page
// =============================================================================
router.get('/create', (req, res) => {
    const now = new Date().toISOString();
    
    // Insert new draft workshop with default values
    db.run(
        "INSERT INTO events (title, description, event_date, created_at, updated_at, status) VALUES (?, ?, ?, ?, ?, 'draft')",
        ['New Workshop', '', now, now, now],
        function(err) {
            if (err) return res.status(500).send('Create failed');
            res.redirect(`/organiser/edit/${this.lastID}`);
        }
    );
});

// START
// =============================================================================
// GET: View All Reservations
// Purpose: Display booking summary for all workshops
// Input: None
// Output: Renders reservation summary page with all bookings
// =============================================================================
router.get('/view-bookings', (req, res) => {
    const eventQuery = `SELECT * FROM events ORDER BY event_date ASC`;

    db.all(eventQuery, [], (err, events) => {
        if (err) return res.status(500).send("Failed to fetch workshops");

        // For each workshop, get its bookings including email and dietary notes
        const all = Promise.all(events.map(event => {
            return new Promise(resolve => {
                db.all(
                    `SELECT attendee_name, attendee_email, ticket_type, quantity, booking_date, dietary_notes
                    FROM bookings WHERE event_id = ? ORDER BY booking_date ASC`,
                    [event.event_id],
                    (err2, bookings) => {
                        event.bookings = bookings || [];
                        resolve();
                    }
                );
            });
        }));

        all.then(() => {
            res.render('reservations', { events });
        });
    });
});

// =============================================================================
// GET: Academy Settings Page
// Purpose: Display form to edit site name and description
// Input: None
// Output: Renders settings page with current values
// =============================================================================
router.get('/settings', (req, res) => {
    db.get('SELECT * FROM settings WHERE id = 1', (err, settings) => {
        if (err || !settings) return res.status(500).send("Settings not found");
        res.render('configure', { settings });
    });
});

// =============================================================================
// POST: Update Academy Settings
// Purpose: Save new site name and description
// Input: site_name and site_description from form body
// Output: Updates settings, redirects to dashboard
// =============================================================================
router.post('/settings', (req, res) => {
    const { site_name, site_description } = req.body;

    // Form validation: both fields required
    if (!site_name.trim() || !site_description.trim()) {
        return res.status(400).send("Both name and description are required.");
    }
    
    // Update settings in database
    db.run(
        'UPDATE settings SET site_name = ?, site_description = ? WHERE id = 1',
        [site_name, site_description],
        (err) => {
            if (err) return res.status(500).send("Update failed");
            res.redirect('/organiser');
        }
    );
});

// =============================================================================
// GET: Edit Workshop Page
// Purpose: Display form to edit workshop details
// Input: Workshop ID from URL params
// Output: Renders edit page with current workshop data and categories
// =============================================================================
router.get('/edit/:id', (req, res) => {
    const eventId = req.params.id;

    // Get workshop details
    db.get('SELECT * FROM events WHERE event_id = ?', [eventId], (err, event) => {
        if (err || !event) return res.status(500).send("Workshop not found");

        // Get ticket types for this workshop
        db.all('SELECT * FROM tickets WHERE event_id = ?', [eventId], (err2, tickets) => {
            if (err2) return res.status(500).send("Ticket query failed");

            // Separate tickets by type (full = standard, concession = student/senior)
            const full = tickets.find(t => t.type === 'full') || { quantity: 0, price: 0 };
            const concession = tickets.find(t => t.type === 'concession') || { quantity: 0, price: 0 };

            // Get all categories for dropdown (extension feature)
            db.all('SELECT * FROM categories ORDER BY name ASC', [], (err3, categories) => {
                res.render('workshop_form', {
                    event,
                    full,
                    concession,
                    categories: categories || []
                });
            });
        });
    });
});
// END

// =============================================================================
// POST: Update Workshop
// Purpose: Save changes to workshop details and seat configuration
// Input: Workshop ID from params, form data from body
// Output: Updates workshop and tickets, redirects to dashboard
// =============================================================================
router.post('/edit/:id', (req, res) => {
    const eventId = req.params.id;
    const {
        title,
        description,
        event_date,
        category_id,
        full_price,
        full_quantity,
        concession_price,
        concession_quantity
    } = req.body;

    const updatedAt = new Date().toISOString();

    // Basic validation: title and date required
    if (!title.trim() || !event_date.trim()) {
        return res.status(400).send("Title and workshop date are required.");
    }

    // Update the main workshop info
    db.run(
        'UPDATE events SET title = ?, description = ?, event_date = ?, category_id = ?, updated_at = ? WHERE event_id = ?',
        [title.trim(), description.trim(), event_date, category_id || null, updatedAt, eventId],
        function(err) {
            if (err) return res.status(500).send("Failed to update workshop.");

            /**
             * Helper: saveOrUpdateTicket
             * Purpose: Insert or update ticket/seat configuration
             * Input: eventId, type, price, quantity, callback
             * Output: Creates or updates ticket record
             */
            function saveOrUpdateTicket(eventId, type, price, quantity, callback) {
                db.get(
                    'SELECT COUNT(*) AS count FROM tickets WHERE event_id = ? AND type = ?',
                    [eventId, type],
                    (err, row) => {
                        if (err) return callback(err);

                        if (row.count > 0) {
                            // Update existing ticket type
                            db.run(
                                'UPDATE tickets SET price = ?, quantity = ? WHERE event_id = ? AND type = ?',
                                [price, quantity, eventId, type],
                                callback
                            );
                        } else {
                            // Insert new ticket type
                            db.run(
                                'INSERT INTO tickets (event_id, type, price, quantity) VALUES (?, ?, ?, ?)',
                                [eventId, type, price, quantity],
                                callback
                            );
                        }
                    }
                );
            }

            // Save standard seats (full price)
            saveOrUpdateTicket(eventId, 'full', parseFloat(full_price), parseInt(full_quantity), (err2) => {
                if (err2) return res.status(500).send("Failed to save standard seats.");

                // Save student/senior seats (concession)
                saveOrUpdateTicket(eventId, 'concession', parseFloat(concession_price), parseInt(concession_quantity), (err3) => {
                    if (err3) return res.status(500).send("Failed to save concession seats.");

                    res.redirect('/organiser');
                });
            });
        }
    );
});

module.exports = router;
