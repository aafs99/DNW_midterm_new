/**
 * routes/attendee.js
 * Attendee Routes - Public Event Browsing and Booking
 * 
 * Purpose: Handle event listing, filtering, booking, and waitlist
 * Database: Uses global.db (single connection from index.js)
 * Authentication: None required (public routes)
 */

const express = require('express');
const router = express.Router();
const { sanitizeInput, isValidEmail, formatDateShort, parsePositiveInt } = require('../utils/helpers');

const MAX_TICKETS_PER_BOOKING = 10;

// =============================================================================
// HELPER FUNCTIONS
// Note: Common helpers imported from utils/helpers.js
// =============================================================================

// =============================================================================
// SETTINGS MIDDLEWARE
// Purpose: Load site settings for all attendee pages (for navbar/title)
// Input: None
// Output: res.locals.settings available in all templates
// =============================================================================
router.use((req, res, next) => {
    global.db.get('SELECT * FROM settings WHERE id = 1', [], (err, settings) => {
        if (err || !settings) {
            res.locals.settings = { site_name: 'Event Manager', site_description: '' };
        } else {
            res.locals.settings = settings;
        }
        next();
    });
});

// =============================================================================
// ATTENDEE HOME PAGE
// =============================================================================

/**
 * GET /attendee
 * Purpose: Display attendee home page with published events
 * Input: req.query.category (optional filter) [EXTENSION]
 * Output: Renders attendee_home.ejs with settings, events, categories
 * Database: SELECT from settings, categories, events tables
 */
router.get('/', (req, res) => {
    const selectedCategory = req.query.category || null;

    global.db.get('SELECT * FROM settings WHERE id = 1', (err, settings) => {
        if (err || !settings) {
            console.error('Settings error:', err);
            return res.status(500).send('Settings not found');
        }

        global.db.all('SELECT * FROM categories ORDER BY name ASC', [], (err2, categories) => {
            if (err2) {
                console.error('Categories error:', err2);
                categories = [];
            }

            let eventQuery = `
                SELECT e.*, c.name as category_name 
                FROM events e 
                LEFT JOIN categories c ON e.category_id = c.category_id 
                WHERE e.status = 'published'
            `;
            let params = [];

            if (selectedCategory) {
                eventQuery += ' AND e.category_id = ?';
                params.push(selectedCategory);
            }

            eventQuery += ' ORDER BY e.event_date ASC';

            global.db.all(eventQuery, params, (err3, events) => {
                if (err3) {
                    console.error('Events error:', err3);
                    return res.status(500).send('Event list failed');
                }

                res.render('attendee_home', {
                    settings,
                    events,
                    categories: categories || [],
                    selectedCategory
                });
            });
        });
    });
});

// =============================================================================
// ATTENDEE EVENT PAGE
// =============================================================================

/**
 * GET /attendee/event/:id
 * Purpose: Display single event details with booking form
 * Input: req.params.id (event ID)
 * Output: Renders attendee_event.ejs with event, tickets, availability
 * Database: SELECT from events, tickets, bookings, waitlist tables
 */
router.get('/event/:id', (req, res) => {
    const eventId = req.params.id;

    if (!eventId || isNaN(eventId)) {
        return res.status(400).send('Invalid event ID. <a href="/attendee">Back to events</a>');
    }

    global.db.get(
        'SELECT * FROM events WHERE event_id = ? AND status = ?',
        [eventId, 'published'],
        (err, event) => {
            if (err) {
                console.error('Event query error:', err);
                return res.status(500).send('Database error');
            }

            if (!event) {
                return res.status(404).send('Event not found. <a href="/attendee">Back to events</a>');
            }

            global.db.all('SELECT * FROM tickets WHERE event_id = ?', [eventId], (err2, tickets) => {
                if (err2) {
                    console.error('Tickets error:', err2);
                    return res.status(500).send('Ticket error');
                }

                global.db.all(
                    'SELECT ticket_type, SUM(quantity) as booked FROM bookings WHERE event_id = ? GROUP BY ticket_type',
                    [eventId],
                    (err3, bookings) => {
                        if (err3) {
                            console.error('Bookings error:', err3);
                            return res.status(500).send('Booking error');
                        }

                        let totalRemaining = 0;
                        const ticketData = tickets.map(ticket => {
                            const booked = bookings.find(b => b.ticket_type === ticket.type);
                            const remaining = ticket.quantity - (booked ? booked.booked : 0);
                            totalRemaining += Math.max(0, remaining);
                            return { ...ticket, remaining: Math.max(0, remaining) };
                        });

                        const isSoldOut = totalRemaining === 0;

                        global.db.get(
                            "SELECT COUNT(*) as count FROM waitlist WHERE event_id = ? AND status = 'waiting'",
                            [eventId],
                            (err4, waitlistResult) => {
                                const waitlistCount = waitlistResult ? waitlistResult.count : 0;

                                res.render('attendee_event', {
                                    event,
                                    tickets: ticketData,
                                    maxPerBooking: MAX_TICKETS_PER_BOOKING,
                                    isSoldOut,
                                    waitlistCount
                                });
                            }
                        );
                    }
                );
            });
        }
    );
});

// =============================================================================
// BOOKING
// =============================================================================

/**
 * POST /attendee/event/:id/book
 * Purpose: Create booking for event tickets
 * Input: req.params.id, req.body (attendee_name, attendee_email, quantities, dietary_notes)
 * Output: Redirects to confirmation page or back with error
 * Database: SELECT for validation, INSERT into bookings table
 */
router.post('/event/:id/book', (req, res) => {
    const eventId = req.params.id;

    if (!eventId || isNaN(eventId)) {
        req.flash('error', 'Invalid event.');
        return res.redirect('/attendee');
    }

    const name = sanitizeInput(req.body.attendee_name || '').trim();
    const email = sanitizeInput(req.body.attendee_email || '').trim();
    const dietaryNotes = sanitizeInput(req.body.dietary_notes || '').trim();
    const fullQty = parseInt(req.body.full_quantity) || 0;
    const concessionQty = parseInt(req.body.concession_quantity) || 0;
    const totalQty = fullQty + concessionQty;
    const now = new Date().toISOString();

    if (!name || name.length < 2) {
        req.flash('error', 'Name is required (minimum 2 characters).');
        return res.redirect('/attendee/event/' + eventId);
    }

    if (email && !isValidEmail(email)) {
        req.flash('error', 'Invalid email format.');
        return res.redirect('/attendee/event/' + eventId);
    }

    if (totalQty === 0) {
        req.flash('error', 'Please select at least one ticket.');
        return res.redirect('/attendee/event/' + eventId);
    }

    if (totalQty > MAX_TICKETS_PER_BOOKING) {
        req.flash('error', `Maximum ${MAX_TICKETS_PER_BOOKING} tickets per booking.`);
        return res.redirect('/attendee/event/' + eventId);
    }

    global.db.get(
        'SELECT * FROM events WHERE event_id = ? AND status = ?',
        [eventId, 'published'],
        (err, event) => {
            if (err || !event) {
                req.flash('error', 'Event not found.');
                return res.redirect('/attendee');
            }

            const eventDate = new Date(event.event_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (eventDate < today) {
                req.flash('error', 'This event has already passed.');
                return res.redirect('/attendee/event/' + eventId);
            }

            global.db.all('SELECT * FROM tickets WHERE event_id = ?', [eventId], (err2, tickets) => {
                if (err2) {
                    req.flash('error', 'Error checking availability.');
                    return res.redirect('/attendee/event/' + eventId);
                }

                global.db.all(
                    'SELECT ticket_type, SUM(quantity) as booked FROM bookings WHERE event_id = ? GROUP BY ticket_type',
                    [eventId],
                    (err3, bookings) => {
                        if (err3) {
                            req.flash('error', 'Error checking availability.');
                            return res.redirect('/attendee/event/' + eventId);
                        }

                        const available = {};
                        tickets.forEach(t => {
                            const booked = bookings.find(b => b.ticket_type === t.type);
                            available[t.type] = t.quantity - (booked ? booked.booked : 0);
                        });

                        if (fullQty > (available.full || 0)) {
                            req.flash('error', `Only ${available.full || 0} full-price tickets available.`);
                            return res.redirect('/attendee/event/' + eventId);
                        }

                        if (concessionQty > (available.concession || 0)) {
                            req.flash('error', `Only ${available.concession || 0} concession tickets available.`);
                            return res.redirect('/attendee/event/' + eventId);
                        }

                        const insertBooking = (type, qty, callback) => {
                            if (qty > 0) {
                                global.db.run(
                                    `INSERT INTO bookings (event_id, attendee_name, attendee_email, ticket_type, quantity, booking_date, dietary_notes)
                                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                    [eventId, name, email || null, type, qty, now, dietaryNotes || null],
                                    callback
                                );
                            } else {
                                callback(null);
                            }
                        };

                        insertBooking('full', fullQty, (err4) => {
                            if (err4) {
                                console.error('Booking error:', err4);
                                req.flash('error', 'Booking failed.');
                                return res.redirect('/attendee/event/' + eventId);
                            }

                            insertBooking('concession', concessionQty, (err5) => {
                                if (err5) {
                                    console.error('Booking error:', err5);
                                    req.flash('error', 'Booking failed.');
                                    return res.redirect('/attendee/event/' + eventId);
                                }

                                req.flash('success', 'Tickets booked successfully!');
                                res.redirect(`/attendee/confirmation/${eventId}?name=${encodeURIComponent(name)}`);
                            });
                        });
                    }
                );
            });
        }
    );
});

// =============================================================================
// BOOKING CONFIRMATION
// =============================================================================

/**
 * GET /attendee/confirmation/:id
 * Purpose: Display booking confirmation
 * Input: req.params.id (event ID), req.query.name (attendee name)
 * Output: Renders booking_confirmation.ejs with booking details
 * Database: SELECT from events, bookings, tickets tables
 */
router.get('/confirmation/:id', (req, res) => {
    const eventId = req.params.id;
    const attendeeName = req.query.name;

    if (!eventId || !attendeeName) {
        req.flash('error', 'Invalid confirmation request.');
        return res.redirect('/attendee');
    }

    global.db.get('SELECT * FROM events WHERE event_id = ?', [eventId], (err, event) => {
        if (err || !event) {
            req.flash('error', 'Event not found.');
            return res.redirect('/attendee');
        }

        // Get only the most recent bookings (within last 5 minutes) to avoid showing old bookings
        global.db.all(
            `SELECT ticket_type, quantity, booking_date
             FROM bookings
             WHERE event_id = ? AND attendee_name = ?
             AND booking_date >= datetime('now', '-5 minutes')
             ORDER BY booking_date DESC`,
            [eventId, attendeeName],
            (err2, bookings) => {
                if (err2 || !bookings || bookings.length === 0) {
                    req.flash('error', 'No recent bookings found.');
                    return res.redirect('/attendee');
                }

                global.db.all('SELECT type, price FROM tickets WHERE event_id = ?', [eventId], (err3, tickets) => {
                    if (err3) {
                        req.flash('error', 'Failed to load ticket prices.');
                        return res.redirect('/attendee');
                    }

                    const priceMap = {};
                    tickets.forEach(t => priceMap[t.type] = t.price);

                    let totalQuantity = 0;
                    let totalPrice = 0;

                    bookings.forEach(b => {
                        totalQuantity += b.quantity;
                        totalPrice += b.quantity * (priceMap[b.ticket_type] || 0);
                    });

                    res.render('booking_confirmation', {
                        event,
                        bookings,
                        attendeeName,
                        totalQuantity,
                        totalPrice
                    });
                });
            }
        );
    });
});

// =============================================================================
// WAITLIST [EXTENSION]
// =============================================================================

/**
 * POST /attendee/event/:id/waitlist
 * Purpose: Add attendee to waitlist when event is sold out
 * Input: req.params.id, req.body (attendee_name, attendee_email, ticket_type, quantity)
 * Output: Redirects back with success/error message
 * Database: SELECT for validation, INSERT into waitlist table
 */
router.post('/event/:id/waitlist', (req, res) => {
    const eventId = req.params.id;

    if (!eventId || isNaN(eventId)) {
        req.flash('error', 'Invalid event.');
        return res.redirect('/attendee');
    }

    const name = sanitizeInput(req.body.attendee_name || '').trim();
    const email = sanitizeInput(req.body.attendee_email || '').trim();
    const ticketType = req.body.ticket_type || 'full';
    const quantity = parseInt(req.body.quantity) || 1;
    const now = new Date().toISOString();

    if (!name || name.length < 2) {
        req.flash('error', 'Name is required (minimum 2 characters).');
        return res.redirect('/attendee/event/' + eventId);
    }

    if (!email || !isValidEmail(email)) {
        req.flash('error', 'Valid email is required for waitlist notification.');
        return res.redirect('/attendee/event/' + eventId);
    }

    if (quantity < 1 || quantity > MAX_TICKETS_PER_BOOKING) {
        req.flash('error', `Quantity must be between 1 and ${MAX_TICKETS_PER_BOOKING}.`);
        return res.redirect('/attendee/event/' + eventId);
    }

    global.db.get(
        'SELECT * FROM events WHERE event_id = ? AND status = ?',
        [eventId, 'published'],
        (err, event) => {
            if (err || !event) {
                req.flash('error', 'Event not found.');
                return res.redirect('/attendee');
            }

            global.db.get(
                "SELECT * FROM waitlist WHERE event_id = ? AND attendee_email = ? AND status = 'waiting'",
                [eventId, email],
                (err2, existing) => {
                    if (err2) {
                        req.flash('error', 'Database error.');
                        return res.redirect('/attendee/event/' + eventId);
                    }

                    if (existing) {
                        req.flash('error', 'You are already on the waitlist for this event.');
                        return res.redirect('/attendee/event/' + eventId);
                    }

                    global.db.run(
                        `INSERT INTO waitlist (event_id, attendee_name, attendee_email, ticket_type, quantity, requested_at, status)
                         VALUES (?, ?, ?, ?, ?, ?, 'waiting')`,
                        [eventId, name, email, ticketType, quantity, now],
                        function(err3) {
                            if (err3) {
                                console.error('Waitlist insert error:', err3);
                                req.flash('error', 'Failed to join waitlist.');
                                return res.redirect('/attendee/event/' + eventId);
                            }

                            global.db.get(
                                "SELECT COUNT(*) as position FROM waitlist WHERE event_id = ? AND status = 'waiting' AND requested_at <= ?",
                                [eventId, now],
                                (err4, result) => {
                                    const position = result ? result.position : '?';
                                    req.flash('success', `Added to waitlist! Position: #${position}. We will email ${email} if tickets become available.`);
                                    res.redirect('/attendee/event/' + eventId);
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

module.exports = router;