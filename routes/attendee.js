/**
 * attendee.js
 * Guest Portal Routes for flavour Academy
 *
 * @description Handles workshop browsing, filtering, and seat reservations
 * with input validation and booking limits
 */

const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Maximum seats per booking to prevent abuse */
const MAX_TICKETS_PER_BOOKING = 10;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid or empty
 */
function isValidEmail(email) {
    if (!email) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Sanitizes string input to prevent XSS
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
 * GET /attendee
 * @description Display published workshops with optional category filter
 * @param {string} req.query.category - Optional category ID for filtering
 * @returns {HTML} Renders catalog/attendee_home template
 */
router.get('/', (req, res) => {
    const selectedCategory = req.query.category || null;

    // Get site settings
    db.get('SELECT * FROM settings WHERE id = 1', (err, settings) => {
        if (err || !settings) {
            console.error('Settings error:', err);
            return res.status(500).send("Settings not found");
        }

        // Get all categories for filter buttons
        db.all('SELECT * FROM categories ORDER BY name ASC', [], (err2, categories) => {
            if (err2) {
                console.error('Categories error:', err2);
                categories = [];
            }

            // Build query based on category filter
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

            // Get published workshops
            db.all(eventQuery, params, (err3, events) => {
                if (err3) {
                    console.error('Events error:', err3);
                    return res.status(500).send("Workshop list failed");
                }

                res.render('attendee_home', {
                    settings,
                    events,
                    categories,
                    selectedCategory
                });
            });
        });
    });
});

/**
 * GET /attendee/event/:id
 * @description Display workshop details and booking form
 * Shows waitlist option if workshop is sold out
 * @param {number} req.params.id - Workshop ID
 * @returns {HTML} Renders workshop_detail/attendee_event template
 */
router.get('/event/:id', (req, res) => {
    const eventId = req.params.id;

    // Validate event ID
    if (!eventId || isNaN(eventId)) {
        return res.status(400).send('Invalid workshop ID. <a href="/attendee">Back to workshops</a>');
    }

    // Get workshop details
    db.get('SELECT * FROM events WHERE event_id = ? AND status = ?', [eventId, 'published'], (err, event) => {
        if (err) {
            console.error('Event query error:', err);
            return res.status(500).send("Database error");
        }

        if (!event) {
            return res.status(404).send('Workshop not found. <a href="/attendee">Back to workshops</a>');
        }

        // Get ticket types
        db.all('SELECT * FROM tickets WHERE event_id = ?', [eventId], (err2, tickets) => {
            if (err2) {
                console.error('Tickets error:', err2);
                return res.status(500).send("Seat error");
            }

            // Get booked counts
            db.all(
                `SELECT ticket_type, SUM(quantity) as booked 
                 FROM bookings WHERE event_id = ? GROUP BY ticket_type`,
                [eventId],
                (err3, bookings) => {
                    if (err3) {
                        console.error('Bookings error:', err3);
                        return res.status(500).send("Booking error");
                    }

                    // Calculate remaining seats and check if sold out
                    let totalRemaining = 0;
                    const ticketData = tickets.map(ticket => {
                        const booked = bookings.find(b => b.ticket_type === ticket.type);
                        const remaining = ticket.quantity - (booked ? booked.booked : 0);
                        totalRemaining += Math.max(0, remaining);
                        return { ...ticket, remaining: Math.max(0, remaining) };
                    });

                    const isSoldOut = totalRemaining === 0;

                    // Get waitlist count for this event
                    db.get(
                        `SELECT COUNT(*) as count FROM waitlist WHERE event_id = ? AND status = 'waiting'`,
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
    });
});

/**
 * POST /attendee/event/:id/book
 * @description Create seat reservation with validation
 * @param {number} req.params.id - Workshop ID
 * @param {string} req.body.attendee_name - Guest name (required)
 * @param {string} req.body.attendee_email - Guest email (optional)
 * @param {string} req.body.dietary_notes - Dietary requirements (optional)
 * @param {number} req.body.full_quantity - Standard seats requested
 * @param {number} req.body.concession_quantity - Concession seats requested
 * @returns {Redirect} To confirmation page or back with error
 */
router.post('/event/:id/book', (req, res) => {
    const eventId = req.params.id;

    // Validate event ID
    if (!eventId || isNaN(eventId)) {
        req.flash('error', 'Invalid workshop.');
        return res.redirect('/attendee');
    }

    // Extract and sanitize form data
    const name = sanitize(req.body.attendee_name || '').trim();
    const email = sanitize(req.body.attendee_email || '').trim();
    const dietaryNotes = sanitize(req.body.dietary_notes || '').trim();
    const fullQty = parseInt(req.body.full_quantity) || 0;
    const concessionQty = parseInt(req.body.concession_quantity) || 0;
    const totalQty = fullQty + concessionQty;
    const now = new Date().toISOString();

    // Validate name
    if (!name) {
        req.flash('error', 'Name is required.');
        return res.redirect('/attendee/event/' + eventId);
    }

    if (name.length < 2 || name.length > 100) {
        req.flash('error', 'Name must be 2 to 100 characters.');
        return res.redirect('/attendee/event/' + eventId);
    }

    // Validate email if provided
    if (email && !isValidEmail(email)) {
        req.flash('error', 'Invalid email format.');
        return res.redirect('/attendee/event/' + eventId);
    }

    // Validate at least one seat selected
    if (totalQty === 0) {
        req.flash('error', 'Please select at least one seat.');
        return res.redirect('/attendee/event/' + eventId);
    }

    // Validate maximum seats per booking
    if (totalQty > MAX_TICKETS_PER_BOOKING) {
        req.flash('error', `Maximum ${MAX_TICKETS_PER_BOOKING} seats per booking.`);
        return res.redirect('/attendee/event/' + eventId);
    }

    // Validate no negative values
    if (fullQty < 0 || concessionQty < 0) {
        req.flash('error', 'Invalid seat quantity.');
        return res.redirect('/attendee/event/' + eventId);
    }

    // Verify workshop exists and is published
    db.get('SELECT * FROM events WHERE event_id = ? AND status = ?', [eventId, 'published'], (err, event) => {
        if (err || !event) {
            req.flash('error', 'Workshop not found or not available.');
            return res.redirect('/attendee');
        }

        // Check workshop date is in future
        const eventDate = new Date(event.event_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (eventDate < today) {
            req.flash('error', 'This workshop has already passed.');
            return res.redirect('/attendee/event/' + eventId);
        }

        // Get current availability
        db.all('SELECT * FROM tickets WHERE event_id = ?', [eventId], (err2, tickets) => {
            if (err2) {
                req.flash('error', 'Error checking availability.');
                return res.redirect('/attendee/event/' + eventId);
            }

            db.all(
                'SELECT ticket_type, SUM(quantity) as booked FROM bookings WHERE event_id = ? GROUP BY ticket_type',
                [eventId],
                (err3, bookings) => {
                    if (err3) {
                        req.flash('error', 'Error checking availability.');
                        return res.redirect('/attendee/event/' + eventId);
                    }

                    // Calculate available seats
                    const available = {};
                    tickets.forEach(t => {
                        const booked = bookings.find(b => b.ticket_type === t.type);
                        available[t.type] = t.quantity - (booked ? booked.booked : 0);
                    });

                    // Check availability
                    if (fullQty > (available.full || 0)) {
                        req.flash('error', `Only ${available.full || 0} standard seats available.`);
                        return res.redirect('/attendee/event/' + eventId);
                    }

                    if (concessionQty > (available.concession || 0)) {
                        req.flash('error', `Only ${available.concession || 0} concession seats available.`);
                        return res.redirect('/attendee/event/' + eventId);
                    }

                    // Insert bookings
                    const insert = db.prepare(`
                        INSERT INTO bookings 
                        (event_id, attendee_name, attendee_email, ticket_type, quantity, booking_date, dietary_notes)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `);

                    if (fullQty > 0) {
                        insert.run(eventId, name, email || null, 'full', fullQty, now, dietaryNotes || null);
                    }

                    if (concessionQty > 0) {
                        insert.run(eventId, name, email || null, 'concession', concessionQty, now, dietaryNotes || null);
                    }

                    insert.finalize((err4) => {
                        if (err4) {
                            console.error('Booking insert error:', err4);
                            req.flash('error', 'Failed to complete booking.');
                            return res.redirect('/attendee/event/' + eventId);
                        }

                        req.flash('success', 'Seats reserved successfully!');
                        res.redirect(`/attendee/confirmation/${eventId}?name=${encodeURIComponent(name)}`);
                    });
                }
            );
        });
    });
});

/**
 * GET /attendee/confirmation/:id
 * @description Display booking confirmation
 * @param {number} req.params.id - Workshop ID
 * @param {string} req.query.name - Attendee name
 * @returns {HTML} Renders receipt/booking_confirmation template
 */
router.get('/confirmation/:id', (req, res) => {
    const eventId = req.params.id;
    const attendeeName = req.query.name;

    // Validate inputs
    if (!eventId || !attendeeName) {
        req.flash('error', 'Invalid confirmation request.');
        return res.redirect('/attendee');
    }

    // Get workshop info
    db.get('SELECT * FROM events WHERE event_id = ?', [eventId], (err, event) => {
        if (err || !event) {
            req.flash('error', 'Workshop not found.');
            return res.redirect('/attendee');
        }

        // Get guest's bookings
        db.all(`
            SELECT ticket_type, quantity, booking_date
            FROM bookings
            WHERE event_id = ? AND attendee_name = ?
            ORDER BY booking_date DESC
            LIMIT 10
        `, [eventId, attendeeName], (err2, bookings) => {
            if (err2 || !bookings || bookings.length === 0) {
                req.flash('error', 'No reservations found.');
                return res.redirect('/attendee');
            }

            // Get prices
            db.all('SELECT type, price FROM tickets WHERE event_id = ?', [eventId], (err3, tickets) => {
                if (err3) {
                    return res.status(500).send("Price lookup failed");
                }

                const priceMap = {};
                tickets.forEach(t => priceMap[t.type] = t.price);

                // Calculate totals
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
        });
    });
});

// =============================================================================
// WAITLIST ROUTES (EXTENSION)
// Purpose: Allow attendees to join a queue when workshops are fully booked
// Demonstrates: Queue management, complex availability checking, FIFO logic
// =============================================================================

/**
 * POST /attendee/event/:id/waitlist
 * @description Add attendee to waitlist when workshop is sold out
 * @param {number} req.params.id - Workshop ID
 * @param {string} req.body.attendee_name - Guest name (required)
 * @param {string} req.body.attendee_email - Guest email (required for notification)
 * @param {string} req.body.ticket_type - Preferred ticket type
 * @param {number} req.body.quantity - Number of seats wanted
 * @returns {Redirect} To waitlist confirmation or back with error
 */
router.post('/event/:id/waitlist', (req, res) => {
    const eventId = req.params.id;

    // Validate event ID
    if (!eventId || isNaN(eventId)) {
        req.flash('error', 'Invalid workshop.');
        return res.redirect('/attendee');
    }

    // Extract and validate form data
    const name = sanitize(req.body.attendee_name || '').trim();
    const email = sanitize(req.body.attendee_email || '').trim();
    const ticketType = req.body.ticket_type || 'full';
    const quantity = parseInt(req.body.quantity) || 1;
    const now = new Date().toISOString();

    // Validate required fields
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

    // Check event exists and is published
    db.get('SELECT * FROM events WHERE event_id = ? AND status = ?', [eventId, 'published'], (err, event) => {
        if (err || !event) {
            req.flash('error', 'Workshop not found.');
            return res.redirect('/attendee');
        }

        // Check if already on waitlist
        db.get(
            'SELECT * FROM waitlist WHERE event_id = ? AND attendee_email = ? AND status = ?',
            [eventId, email, 'waiting'],
            (err2, existing) => {
                if (err2) {
                    req.flash('error', 'Database error.');
                    return res.redirect('/attendee/event/' + eventId);
                }

                if (existing) {
                    req.flash('error', 'You are already on the waitlist for this workshop.');
                    return res.redirect('/attendee/event/' + eventId);
                }

                // Add to waitlist
                db.run(
                    `INSERT INTO waitlist (event_id, attendee_name, attendee_email, ticket_type, quantity, requested_at, status)
                     VALUES (?, ?, ?, ?, ?, ?, 'waiting')`,
                    [eventId, name, email, ticketType, quantity, now],
                    function(err3) {
                        if (err3) {
                            console.error('Waitlist insert error:', err3);
                            req.flash('error', 'Failed to join waitlist.');
                            return res.redirect('/attendee/event/' + eventId);
                        }

                        // Get position in queue
                        db.get(
                            `SELECT COUNT(*) as position FROM waitlist 
                             WHERE event_id = ? AND status = 'waiting' AND requested_at <= ?`,
                            [eventId, now],
                            (err4, result) => {
                                const position = result ? result.position : '?';
                                req.flash('success', `Added to waitlist! Your position: #${position}. We'll email ${email} if seats become available.`);
                                res.redirect('/attendee/event/' + eventId);
                            }
                        );
                    }
                );
            }
        );
    });
});

/**
 * GET /attendee/waitlist/:id
 * @description Check waitlist status for an event
 * @param {number} req.params.id - Workshop ID
 * @param {string} req.query.email - Email to check
 * @returns {HTML} Renders waitlist status or JSON response
 */
router.get('/waitlist/:id', (req, res) => {
    const eventId = req.params.id;
    const email = req.query.email;

    if (!eventId || !email) {
        return res.status(400).json({ error: 'Event ID and email required' });
    }

    db.get(
        `SELECT w.*, e.title as event_title 
         FROM waitlist w 
         JOIN events e ON w.event_id = e.event_id 
         WHERE w.event_id = ? AND w.attendee_email = ? AND w.status = 'waiting'`,
        [eventId, email],
        (err, entry) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (!entry) {
                return res.json({ onWaitlist: false });
            }

            // Get position
            db.get(
                `SELECT COUNT(*) as position FROM waitlist 
                 WHERE event_id = ? AND status = 'waiting' AND requested_at <= ?`,
                [eventId, entry.requested_at],
                (err2, result) => {
                    res.json({
                        onWaitlist: true,
                        position: result ? result.position : null,
                        eventTitle: entry.event_title,
                        quantity: entry.quantity,
                        ticketType: entry.ticket_type,
                        requestedAt: entry.requested_at
                    });
                }
            );
        }
    );
});

module.exports = router;
