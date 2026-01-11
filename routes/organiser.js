/**
 * organiser.js
 * Chef Dashboard Routes for flavour Academy
 *
 * @description Handles workshop CRUD operations, settings management,
 * and reservation viewing with authentication middleware
 * @requires express-session for authentication
 */

const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

// =============================================================================
// AUTHENTICATION MIDDLEWARE
// =============================================================================

/**
 * Authentication Guard
 * @description Protects all organiser routes from unauthorized access
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
router.use((req, res, next) => {
    if (req.session && req.session.authenticated) {
        next();
    } else {
        res.redirect('/login');
    }
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Formats ISO date string to human readable format
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date (e.g., "15 Jan 2025, 14:30")
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
 * Calculates remaining tickets for each event
 * @param {Array} events - Array of event objects
 * @returns {Promise} Resolves when all events have ticket info
 */
function addRemainingTicketInfo(events) {
    return Promise.all(events.map(event => {
        return new Promise(resolve => {
            db.all(
                `SELECT type, quantity FROM tickets WHERE event_id = ?`,
                [event.event_id],
                (err, tickets) => {
                    if (err) return resolve();

                    db.all(
                        `SELECT ticket_type, SUM(quantity) as booked
                         FROM bookings WHERE event_id = ? GROUP BY ticket_type`,
                        [event.event_id],
                        (err2, bookings) => {
                            if (err2) return resolve();

                            const remaining = {};
                            tickets.forEach(ticket => {
                                const booked = bookings.find(b => b.ticket_type === ticket.type);
                                remaining[ticket.type] = ticket.quantity - (booked ? booked.booked : 0);
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

/**
 * Validates workshop date is in future
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if date is today or future
 */
function isValidFutureDate(dateString) {
    const inputDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return inputDate >= today;
}

/**
 * Sanitizes string input
 * @param {string} str - Input string
 * @returns {string} Sanitized string
 */
function sanitize(str) {
    if (!str) return '';
    return str.replace(/[<>]/g, '');
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /organiser
 * @description Display chef dashboard with all workshops
 * @returns {HTML} Renders dashboard/organiser_home template
 */
router.get('/', (req, res) => {
    const siteQuery = 'SELECT * FROM settings WHERE id = 1';
    const publishedQuery = "SELECT * FROM events WHERE status = 'published' ORDER BY event_date ASC";
    const draftQuery = "SELECT * FROM events WHERE status = 'draft' ORDER BY created_at DESC";

    db.get(siteQuery, [], (err, settings) => {
        if (err) {
            console.error('Settings error:', err);
            return res.status(500).send('Settings error');
        }

        db.all(publishedQuery, [], (err2, publishedEvents) => {
            if (err2) {
                console.error('Published events error:', err2);
                return res.status(500).send('Workshop error');
            }

            db.all(draftQuery, [], async (err3, draftEvents) => {
                if (err3) {
                    console.error('Draft events error:', err3);
                    return res.status(500).send('Draft error');
                }

                const allEvents = [...publishedEvents, ...draftEvents];
                await addRemainingTicketInfo(allEvents);

                // Format timestamps
                publishedEvents.forEach(event => {
                    event.created_at_formatted = formatDate(event.created_at);
                    event.published_at_formatted = formatDate(event.published_at);
                    event.updated_at_formatted = formatDate(event.updated_at);
                });

                draftEvents.forEach(event => {
                    event.created_at_formatted = formatDate(event.created_at);
                    event.updated_at_formatted = formatDate(event.updated_at);
                });

                res.render('organiser_home', {
                    settings,
                    publishedEvents,
                    draftEvents
                });
            });
        });
    });
});

/**
 * POST /organiser/delete/:id
 * @description Delete a workshop and associated data
 * @param {number} req.params.id - Workshop ID to delete
 * @returns {Redirect} To dashboard
 */
router.post('/delete/:id', (req, res) => {
    const eventId = req.params.id;

    if (!eventId || isNaN(eventId)) {
        return res.status(400).send('Invalid workshop ID');
    }

    db.run('DELETE FROM events WHERE event_id = ?', [eventId], function(err) {
        if (err) {
            console.error('Delete error:', err);
            return res.status(500).send('Delete failed');
        }
        res.redirect('/organiser');
    });
});

/**
 * POST /organiser/publish/:id
 * @description Publish a draft workshop
 * @param {number} req.params.id - Workshop ID to publish
 * @returns {Redirect} To dashboard
 */
router.post('/publish/:id', (req, res) => {
    const eventId = req.params.id;

    if (!eventId || isNaN(eventId)) {
        return res.status(400).send('Invalid workshop ID');
    }

    const publishedAt = new Date().toISOString();

    db.run(
        "UPDATE events SET status = 'published', published_at = ? WHERE event_id = ?",
        [publishedAt, eventId],
        function(err) {
            if (err) {
                console.error('Publish error:', err);
                return res.status(500).send('Publish failed');
            }
            res.redirect('/organiser');
        }
    );
});

/**
 * GET /organiser/create
 * @description Create new draft workshop and redirect to edit
 * @returns {Redirect} To edit page for new workshop
 */
router.get('/create', (req, res) => {
    const now = new Date().toISOString();
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7); // Default to 1 week from now
    const defaultDateStr = defaultDate.toISOString().split('T')[0];

    db.run(
        "INSERT INTO events (title, description, event_date, created_at, updated_at, status) VALUES (?, ?, ?, ?, ?, 'draft')",
        ['New Workshop', '', defaultDateStr, now, now],
        function(err) {
            if (err) {
                console.error('Create error:', err);
                return res.status(500).send('Create failed');
            }
            res.redirect(`/organiser/edit/${this.lastID}`);
        }
    );
});

/**
 * GET /organiser/view-bookings
 * @description Display all reservations grouped by workshop
 * @returns {HTML} Renders reservations/view_bookings template
 */
router.get('/view-bookings', (req, res) => {
    const eventQuery = `SELECT * FROM events ORDER BY event_date ASC`;

    db.all(eventQuery, [], (err, events) => {
        if (err) {
            console.error('Events error:', err);
            return res.status(500).send("Failed to fetch workshops");
        }

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
            res.render('view_bookings', { events });
        });
    });
});

/**
 * GET /organiser/settings
 * @description Display site settings form
 * @returns {HTML} Renders configure/site_settings template
 */
router.get('/settings', (req, res) => {
    db.get('SELECT * FROM settings WHERE id = 1', (err, settings) => {
        if (err || !settings) {
            console.error('Settings error:', err);
            return res.status(500).send("Settings not found");
        }
        res.render('site_settings', { settings });
    });
});

/**
 * POST /organiser/settings
 * @description Update site settings
 * @param {string} req.body.site_name - Site name (required)
 * @param {string} req.body.site_description - Site description (required)
 * @returns {Redirect} To dashboard
 */
router.post('/settings', (req, res) => {
    const site_name = sanitize(req.body.site_name || '').trim();
    const site_description = sanitize(req.body.site_description || '').trim();

    // Validation
    if (!site_name || !site_description) {
        return res.status(400).send("Both name and description are required. <a href='/organiser/settings'>Go back</a>");
    }

    if (site_name.length > 100) {
        return res.status(400).send("Site name must be under 100 characters. <a href='/organiser/settings'>Go back</a>");
    }

    if (site_description.length > 500) {
        return res.status(400).send("Description must be under 500 characters. <a href='/organiser/settings'>Go back</a>");
    }

    db.run(
        'UPDATE settings SET site_name = ?, site_description = ? WHERE id = 1',
        [site_name, site_description],
        (err) => {
            if (err) {
                console.error('Settings update error:', err);
                return res.status(500).send("Update failed");
            }
            res.redirect('/organiser');
        }
    );
});

/**
 * GET /organiser/edit/:id
 * @description Display workshop edit form
 * @param {number} req.params.id - Workshop ID
 * @returns {HTML} Renders workshop_form/edit_event template
 */
router.get('/edit/:id', (req, res) => {
    const eventId = req.params.id;

    if (!eventId || isNaN(eventId)) {
        return res.status(400).send('Invalid workshop ID');
    }

    db.get('SELECT * FROM events WHERE event_id = ?', [eventId], (err, event) => {
        if (err || !event) {
            console.error('Event error:', err);
            return res.status(500).send("Workshop not found");
        }

        db.all('SELECT * FROM tickets WHERE event_id = ?', [eventId], (err2, tickets) => {
            if (err2) {
                console.error('Tickets error:', err2);
                return res.status(500).send("Ticket query failed");
            }

            const full = tickets.find(t => t.type === 'full') || { quantity: 0, price: 0 };
            const concession = tickets.find(t => t.type === 'concession') || { quantity: 0, price: 0 };

            db.all('SELECT * FROM categories ORDER BY name ASC', [], (err3, categories) => {
                res.render('edit_event', {
                    event,
                    full,
                    concession,
                    categories: categories || []
                });
            });
        });
    });
});

/**
 * POST /organiser/edit/:id
 * @description Update workshop details
 * @param {number} req.params.id - Workshop ID
 * @param {string} req.body.title - Workshop title (required)
 * @param {string} req.body.description - Workshop description
 * @param {string} req.body.event_date - Workshop date (required, must be future)
 * @param {number} req.body.category_id - Category ID (optional)
 * @param {number} req.body.full_price - Standard seat price
 * @param {number} req.body.full_quantity - Standard seat quantity
 * @param {number} req.body.concession_price - Concession seat price
 * @param {number} req.body.concession_quantity - Concession seat quantity
 * @returns {Redirect} To dashboard
 */
router.post('/edit/:id', (req, res) => {
    const eventId = req.params.id;

    if (!eventId || isNaN(eventId)) {
        return res.status(400).send('Invalid workshop ID');
    }

    // Extract and sanitize inputs
    const title = sanitize(req.body.title || '').trim();
    const description = sanitize(req.body.description || '').trim();
    const event_date = req.body.event_date;
    const category_id = req.body.category_id || null;
    const full_price = parseFloat(req.body.full_price) || 0;
    const full_quantity = parseInt(req.body.full_quantity) || 0;
    const concession_price = parseFloat(req.body.concession_price) || 0;
    const concession_quantity = parseInt(req.body.concession_quantity) || 0;

    const updatedAt = new Date().toISOString();

    // Validation
    if (!title) {
        return res.status(400).send("Title is required. <a href='/organiser/edit/" + eventId + "'>Go back</a>");
    }

    if (title.length > 200) {
        return res.status(400).send("Title must be under 200 characters. <a href='/organiser/edit/" + eventId + "'>Go back</a>");
    }

    if (!event_date) {
        return res.status(400).send("Workshop date is required. <a href='/organiser/edit/" + eventId + "'>Go back</a>");
    }

    if (!isValidFutureDate(event_date)) {
        return res.status(400).send("Workshop date must be today or in the future. <a href='/organiser/edit/" + eventId + "'>Go back</a>");
    }

    if (full_price < 0 || concession_price < 0) {
        return res.status(400).send("Prices cannot be negative. <a href='/organiser/edit/" + eventId + "'>Go back</a>");
    }

    if (full_quantity < 0 || concession_quantity < 0) {
        return res.status(400).send("Quantities cannot be negative. <a href='/organiser/edit/" + eventId + "'>Go back</a>");
    }

    if (full_quantity > 1000 || concession_quantity > 1000) {
        return res.status(400).send("Maximum 1000 seats per type. <a href='/organiser/edit/" + eventId + "'>Go back</a>");
    }

    // Update event
    db.run(
        'UPDATE events SET title = ?, description = ?, event_date = ?, category_id = ?, updated_at = ? WHERE event_id = ?',
        [title, description, event_date, category_id, updatedAt, eventId],
        function(err) {
            if (err) {
                console.error('Update error:', err);
                return res.status(500).send("Failed to update workshop.");
            }

            // Update or insert tickets
            function saveTicket(eventId, type, price, quantity, callback) {
                db.get(
                    'SELECT COUNT(*) AS count FROM tickets WHERE event_id = ? AND type = ?',
                    [eventId, type],
                    (err, row) => {
                        if (err) return callback(err);

                        if (row.count > 0) {
                            db.run(
                                'UPDATE tickets SET price = ?, quantity = ? WHERE event_id = ? AND type = ?',
                                [price, quantity, eventId, type],
                                callback
                            );
                        } else {
                            db.run(
                                'INSERT INTO tickets (event_id, type, price, quantity) VALUES (?, ?, ?, ?)',
                                [eventId, type, price, quantity],
                                callback
                            );
                        }
                    }
                );
            }

            saveTicket(eventId, 'full', full_price, full_quantity, (err2) => {
                if (err2) {
                    console.error('Ticket save error:', err2);
                    return res.status(500).send("Failed to save standard seats.");
                }

                saveTicket(eventId, 'concession', concession_price, concession_quantity, (err3) => {
                    if (err3) {
                        console.error('Ticket save error:', err3);
                        return res.status(500).send("Failed to save concession seats.");
                    }

                    res.redirect('/organiser');
                });
            });
        }
    );
});

// =============================================================================
// WAITLIST MANAGEMENT ROUTES (EXTENSION)
// Purpose: Allow organisers to view and manage waitlist entries
// Demonstrates: Complex queries with JOINs, aggregations, queue management
// =============================================================================

/**
 * GET /organiser/waitlist
 * @description Display all waitlist entries grouped by workshop
 * Shows queue position, contact details, and requested quantities
 * @returns {HTML} Renders waitlist management page
 */
router.get('/waitlist', (req, res) => {
    // Complex query: Get waitlist entries with event info, ordered by request time
    const query = `
        SELECT
            w.waitlist_id,
            w.attendee_name,
            w.attendee_email,
            w.ticket_type,
            w.quantity,
            w.requested_at,
            w.status,
            e.event_id,
            e.title as event_title,
            e.event_date
        FROM waitlist w
        JOIN events e ON w.event_id = e.event_id
        WHERE w.status = 'waiting'
        ORDER BY e.event_date ASC, w.requested_at ASC
    `;

    db.all(query, [], (err, entries) => {
        if (err) {
            console.error('Waitlist query error:', err);
            return res.status(500).send('Failed to load waitlist');
        }

        // Group entries by event for display
        const groupedByEvent = {};
        entries.forEach(entry => {
            if (!groupedByEvent[entry.event_id]) {
                groupedByEvent[entry.event_id] = {
                    event_id: entry.event_id,
                    event_title: entry.event_title,
                    event_date: entry.event_date,
                    entries: []
                };
            }
            groupedByEvent[entry.event_id].entries.push(entry);
        });

        // Add position numbers to each entry
        Object.values(groupedByEvent).forEach(event => {
            event.entries.forEach((entry, index) => {
                entry.position = index + 1;
            });
        });

        res.render('view_waitlist', {
            waitlistByEvent: Object.values(groupedByEvent),
            totalEntries: entries.length
        });
    });
});

/**
 * POST /organiser/waitlist/remove/:id
 * @description Remove an entry from the waitlist
 * @param {number} req.params.id - Waitlist entry ID
 * @returns {Redirect} Back to waitlist page
 */
router.post('/waitlist/remove/:id', (req, res) => {
    const waitlistId = req.params.id;

    if (!waitlistId || isNaN(waitlistId)) {
        return res.status(400).send('Invalid waitlist ID');
    }

    db.run(
        "UPDATE waitlist SET status = 'removed' WHERE waitlist_id = ?",
        [waitlistId],
        function(err) {
            if (err) {
                console.error('Waitlist remove error:', err);
                return res.status(500).send('Failed to remove from waitlist');
            }
            res.redirect('/organiser/waitlist');
        }
    );
});

/**
 * POST /organiser/waitlist/notify/:id
 * @description Mark a waitlist entry as notified (simulates email notification)
 * In production, this would send an actual email
 * @param {number} req.params.id - Waitlist entry ID
 * @returns {Redirect} Back to waitlist page
 */
router.post('/waitlist/notify/:id', (req, res) => {
    const waitlistId = req.params.id;
    const now = new Date().toISOString();

    if (!waitlistId || isNaN(waitlistId)) {
        return res.status(400).send('Invalid waitlist ID');
    }

    // Update status and record notification time
    db.run(
        "UPDATE waitlist SET status = 'notified', notified_at = ? WHERE waitlist_id = ?",
        [now, waitlistId],
        function(err) {
            if (err) {
                console.error('Waitlist notify error:', err);
                return res.status(500).send('Failed to mark as notified');
            }
            // In production: Send email to attendee here
            // For demo: Just update the status
            res.redirect('/organiser/waitlist');
        }
    );
});

module.exports = router;
