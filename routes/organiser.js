/**
 * routes/organiser.js
 * Organiser Dashboard Routes
 * 
 * Purpose: Handle event management, settings, bookings, and waitlist
 * Database: Uses global.db (single connection from index.js)
 * Authentication: All routes protected by middleware
 */

const express = require('express');
const router = express.Router();

// =============================================================================
// AUTHENTICATION MIDDLEWARE
// Purpose: Protect all organiser routes from unauthorized access
// Input: req.session.authenticated
// Output: Continues if authenticated, redirects to /login if not
// =============================================================================
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
 * formatDate
 * Purpose: Convert ISO date string to readable format
 * Input: dateString (ISO format)
 * Output: Formatted string e.g. "15 Jan 2025, 14:30"
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
 * calculateRemainingTickets
 * Purpose: Calculate remaining tickets for each event
 * Input: events (array)
 * Output: Promise - resolves when all events have remainingTickets property
 * Database: SELECT from tickets and bookings tables
 */
function calculateRemainingTickets(events) {
    return Promise.all(events.map(event => {
        return new Promise(resolve => {
            global.db.all(
                'SELECT type, quantity FROM tickets WHERE event_id = ?',
                [event.event_id],
                (err, tickets) => {
                    if (err) return resolve();

                    global.db.all(
                        'SELECT ticket_type, SUM(quantity) as booked FROM bookings WHERE event_id = ? GROUP BY ticket_type',
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
 * isValidFutureDate
 * Purpose: Check if date is today or in the future
 * Input: dateString
 * Output: boolean
 */
function isValidFutureDate(dateString) {
    const inputDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return inputDate >= today;
}

/**
 * sanitizeInput
 * Purpose: Basic XSS protection
 * Input: str (string)
 * Output: Sanitized string
 */
function sanitizeInput(str) {
    if (!str) return '';
    return str.replace(/[<>]/g, '');
}

// =============================================================================
// ORGANISER HOME PAGE
// =============================================================================

/**
 * GET /organiser
 * Purpose: Display organiser home page with all events
 * Input: None
 * Output: Renders organiser_home.ejs with settings, published and draft events
 * Database: SELECT from settings, events tables
 */
router.get('/', (req, res) => {
    global.db.get('SELECT * FROM settings WHERE id = 1', [], (err, settings) => {
        if (err) {
            console.error('Settings error:', err);
            return res.status(500).send('Settings error');
        }

        global.db.all(
            "SELECT * FROM events WHERE status = 'published' ORDER BY event_date ASC",
            [],
            (err2, publishedEvents) => {
                if (err2) {
                    console.error('Published events error:', err2);
                    return res.status(500).send('Event error');
                }

                global.db.all(
                    "SELECT * FROM events WHERE status = 'draft' ORDER BY created_at DESC",
                    [],
                    async (err3, draftEvents) => {
                        if (err3) {
                            console.error('Draft events error:', err3);
                            return res.status(500).send('Draft error');
                        }

                        await calculateRemainingTickets([...publishedEvents, ...draftEvents]);

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
                    }
                );
            }
        );
    });
});

// =============================================================================
// EVENT CRUD OPERATIONS
// =============================================================================

/**
 * GET /organiser/create
 * Purpose: Create new draft event and redirect to edit page
 * Input: None
 * Output: Redirects to /organiser/edit/:id
 * Database: INSERT into events table
 */
router.get('/create', (req, res) => {
    const now = new Date().toISOString();
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    const defaultDateStr = defaultDate.toISOString().split('T')[0];

    global.db.run(
        "INSERT INTO events (title, description, event_date, created_at, updated_at, status) VALUES (?, ?, ?, ?, ?, 'draft')",
        ['New Event', '', defaultDateStr, now, now],
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
 * GET /organiser/edit/:id
 * Purpose: Display event edit form
 * Input: req.params.id (event ID)
 * Output: Renders edit_event.ejs with event data, tickets, categories
 * Database: SELECT from events, tickets, categories tables
 */
router.get('/edit/:id', (req, res) => {
    const eventId = req.params.id;

    if (!eventId || isNaN(eventId)) {
        return res.status(400).send('Invalid event ID');
    }

    global.db.get('SELECT * FROM events WHERE event_id = ?', [eventId], (err, event) => {
        if (err || !event) {
            console.error('Event error:', err);
            return res.status(404).send('Event not found');
        }

        global.db.all('SELECT * FROM tickets WHERE event_id = ?', [eventId], (err2, tickets) => {
            if (err2) {
                console.error('Tickets error:', err2);
                return res.status(500).send('Ticket query failed');
            }

            const full = tickets.find(t => t.type === 'full') || { quantity: 0, price: 0 };
            const concession = tickets.find(t => t.type === 'concession') || { quantity: 0, price: 0 };

            global.db.all('SELECT * FROM categories ORDER BY name ASC', [], (err3, categories) => {
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
 * Purpose: Update event details and ticket configuration
 * Input: req.params.id, req.body (title, description, event_date, category_id, ticket data)
 * Output: Redirects to /organiser
 * Database: UPDATE events table, INSERT/UPDATE tickets table
 */
router.post('/edit/:id', (req, res) => {
    const eventId = req.params.id;

    if (!eventId || isNaN(eventId)) {
        return res.status(400).send('Invalid event ID');
    }

    const title = sanitizeInput(req.body.title || '').trim();
    const description = sanitizeInput(req.body.description || '').trim();
    const eventDate = req.body.event_date;
    const categoryId = req.body.category_id || null;
    const fullPrice = parseFloat(req.body.full_price) || 0;
    const fullQuantity = parseInt(req.body.full_quantity) || 0;
    const concessionPrice = parseFloat(req.body.concession_price) || 0;
    const concessionQuantity = parseInt(req.body.concession_quantity) || 0;
    const updatedAt = new Date().toISOString();

    if (!title) {
        return res.status(400).send('Title is required. <a href="/organiser/edit/' + eventId + '">Go back</a>');
    }

    if (!eventDate) {
        return res.status(400).send('Event date is required. <a href="/organiser/edit/' + eventId + '">Go back</a>');
    }

    if (!isValidFutureDate(eventDate)) {
        return res.status(400).send('Event date must be today or in the future. <a href="/organiser/edit/' + eventId + '">Go back</a>');
    }

    if (fullPrice < 0 || concessionPrice < 0 || fullQuantity < 0 || concessionQuantity < 0) {
        return res.status(400).send('Prices and quantities cannot be negative. <a href="/organiser/edit/' + eventId + '">Go back</a>');
    }

    global.db.run(
        'UPDATE events SET title = ?, description = ?, event_date = ?, category_id = ?, updated_at = ? WHERE event_id = ?',
        [title, description, eventDate, categoryId, updatedAt, eventId],
        function(err) {
            if (err) {
                console.error('Update error:', err);
                return res.status(500).send('Failed to update event');
            }

            const saveTicket = (type, price, quantity, callback) => {
                global.db.get(
                    'SELECT COUNT(*) AS count FROM tickets WHERE event_id = ? AND type = ?',
                    [eventId, type],
                    (queryErr, row) => {
                        if (queryErr) return callback(queryErr);

                        if (row.count > 0) {
                            global.db.run(
                                'UPDATE tickets SET price = ?, quantity = ? WHERE event_id = ? AND type = ?',
                                [price, quantity, eventId, type],
                                callback
                            );
                        } else {
                            global.db.run(
                                'INSERT INTO tickets (event_id, type, price, quantity) VALUES (?, ?, ?, ?)',
                                [eventId, type, price, quantity],
                                callback
                            );
                        }
                    }
                );
            };

            saveTicket('full', fullPrice, fullQuantity, (err2) => {
                if (err2) {
                    console.error('Ticket save error:', err2);
                    return res.status(500).send('Failed to save tickets');
                }

                saveTicket('concession', concessionPrice, concessionQuantity, (err3) => {
                    if (err3) {
                        console.error('Ticket save error:', err3);
                        return res.status(500).send('Failed to save tickets');
                    }
                    res.redirect('/organiser');
                });
            });
        }
    );
});

/**
 * POST /organiser/publish/:id
 * Purpose: Change event status from draft to published
 * Input: req.params.id (event ID)
 * Output: Redirects to /organiser
 * Database: UPDATE events table (status and published_at)
 */
router.post('/publish/:id', (req, res) => {
    const eventId = req.params.id;

    if (!eventId || isNaN(eventId)) {
        return res.status(400).send('Invalid event ID');
    }

    const publishedAt = new Date().toISOString();

    global.db.run(
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
 * POST /organiser/delete/:id
 * Purpose: Delete event and associated data (tickets, bookings via CASCADE)
 * Input: req.params.id (event ID)
 * Output: Redirects to /organiser
 * Database: DELETE from events table
 */
router.post('/delete/:id', (req, res) => {
    const eventId = req.params.id;

    if (!eventId || isNaN(eventId)) {
        return res.status(400).send('Invalid event ID');
    }

    global.db.run('DELETE FROM events WHERE event_id = ?', [eventId], function(err) {
        if (err) {
            console.error('Delete error:', err);
            return res.status(500).send('Delete failed');
        }
        res.redirect('/organiser');
    });
});

// =============================================================================
// SITE SETTINGS
// =============================================================================

/**
 * GET /organiser/settings
 * Purpose: Display site settings form
 * Input: None
 * Output: Renders site_settings.ejs with current settings
 * Database: SELECT from settings table
 */
router.get('/settings', (req, res) => {
    global.db.get('SELECT * FROM settings WHERE id = 1', (err, settings) => {
        if (err || !settings) {
            console.error('Settings error:', err);
            return res.status(500).send('Settings not found');
        }
        res.render('site_settings', { settings });
    });
});

/**
 * POST /organiser/settings
 * Purpose: Update site name and description
 * Input: req.body.site_name, req.body.site_description
 * Output: Redirects to /organiser
 * Database: UPDATE settings table
 */
router.post('/settings', (req, res) => {
    const siteName = sanitizeInput(req.body.site_name || '').trim();
    const siteDescription = sanitizeInput(req.body.site_description || '').trim();

    if (!siteName || !siteDescription) {
        return res.status(400).send('Both fields are required. <a href="/organiser/settings">Go back</a>');
    }

    global.db.run(
        'UPDATE settings SET site_name = ?, site_description = ? WHERE id = 1',
        [siteName, siteDescription],
        (err) => {
            if (err) {
                console.error('Settings update error:', err);
                return res.status(500).send('Update failed');
            }
            res.redirect('/organiser');
        }
    );
});

// =============================================================================
// VIEW BOOKINGS
// =============================================================================

/**
 * GET /organiser/view-bookings
 * Purpose: Display all bookings grouped by event
 * Input: None
 * Output: Renders view_bookings.ejs with events and their bookings
 * Database: SELECT from events and bookings tables
 */
router.get('/view-bookings', (req, res) => {
    global.db.all('SELECT * FROM events ORDER BY event_date ASC', [], (err, events) => {
        if (err) {
            console.error('Events error:', err);
            return res.status(500).send('Failed to fetch events');
        }

        const promises = events.map(event => {
            return new Promise(resolve => {
                global.db.all(
                    `SELECT attendee_name, attendee_email, ticket_type, quantity, booking_date, dietary_notes
                     FROM bookings WHERE event_id = ? ORDER BY booking_date ASC`,
                    [event.event_id],
                    (err2, bookings) => {
                        event.bookings = bookings || [];
                        resolve();
                    }
                );
            });
        });

        Promise.all(promises).then(() => {
            res.render('view_bookings', { events });
        });
    });
});

// =============================================================================
// WAITLIST MANAGEMENT [EXTENSION]
// =============================================================================

/**
 * GET /organiser/waitlist
 * Purpose: Display all waitlist entries grouped by event
 * Input: None
 * Output: Renders view_waitlist.ejs with grouped waitlist data
 * Database: SELECT from waitlist and events tables with JOIN
 */
router.get('/waitlist', (req, res) => {
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

    global.db.all(query, [], (err, entries) => {
        if (err) {
            console.error('Waitlist query error:', err);
            return res.status(500).send('Failed to load waitlist');
        }

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
 * Purpose: Remove entry from waitlist
 * Input: req.params.id (waitlist entry ID)
 * Output: Redirects to /organiser/waitlist
 * Database: UPDATE waitlist status to 'removed'
 */
router.post('/waitlist/remove/:id', (req, res) => {
    const waitlistId = req.params.id;

    if (!waitlistId || isNaN(waitlistId)) {
        return res.status(400).send('Invalid waitlist ID');
    }

    global.db.run(
        "UPDATE waitlist SET status = 'removed' WHERE waitlist_id = ?",
        [waitlistId],
        function(err) {
            if (err) {
                console.error('Waitlist remove error:', err);
                return res.status(500).send('Remove failed');
            }
            res.redirect('/organiser/waitlist');
        }
    );
});

/**
 * POST /organiser/waitlist/notify/:id
 * Purpose: Mark waitlist entry as notified
 * Input: req.params.id (waitlist entry ID)
 * Output: Redirects to /organiser/waitlist
 * Database: UPDATE waitlist status and notified_at timestamp
 */
router.post('/waitlist/notify/:id', (req, res) => {
    const waitlistId = req.params.id;
    const now = new Date().toISOString();

    if (!waitlistId || isNaN(waitlistId)) {
        return res.status(400).send('Invalid waitlist ID');
    }

    global.db.run(
        "UPDATE waitlist SET status = 'notified', notified_at = ? WHERE waitlist_id = ?",
        [now, waitlistId],
        function(err) {
            if (err) {
                console.error('Waitlist notify error:', err);
                return res.status(500).send('Notify failed');
            }
            res.redirect('/organiser/waitlist');
        }
    );
});

module.exports = router;