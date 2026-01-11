/**
 * attendee.js
 * Portal Routes for Flavor Academy visitors
 * Handles workshop browsing, filtering, and seat reservations
 */
// START
const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

// =============================================================================
// GET: Guest Portal Home Page
// Purpose: Display published workshops with optional category filtering
// Input: Optional category query parameter for filtering
// Output: Renders workshop listing with site info and categories
// =============================================================================
router.get('/', (req, res) => {
    const selectedCategory = req.query.category || null;

    // Get site settings
    db.get('SELECT * FROM settings WHERE id = 1', (err, settings) => {
        if (err || !settings) return res.status(500).send("Settings not found");

        // Get all categories for filter buttons
        db.all('SELECT * FROM categories ORDER BY name ASC', [], (err2, categories) => {
            if (err2) categories = [];

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
                if (err3) return res.status(500).send("Workshop list failed");

                res.render('catalog', {
                    settings,
                    events,
                    categories,
                    selectedCategory
                });
            });
        });
    });
});

// =============================================================================
// GET: Workshop Detail Page
// Purpose: Display single workshop with seat availability and booking form
// Input: Workshop ID from URL params
// Output: Renders workshop details with available seats
// =============================================================================
router.get('/event/:id', (req, res) => {
    const eventId = req.params.id;

    // Get workshop details
    db.get('SELECT * FROM events WHERE event_id = ?', [eventId], (err, event) => {
        if (err || !event) return res.status(404).send("Workshop not found");

        // Get ticket/seat types for this workshop
        db.all('SELECT * FROM tickets WHERE event_id = ?', [eventId], (err2, tickets) => {
            if (err2) return res.status(500).send("Seat error");

            // Get total booked seats by type
            db.all(
                `SELECT ticket_type, SUM(quantity) as booked FROM bookings WHERE event_id = ? GROUP BY ticket_type`,
                [eventId],
                (err3, bookings) => {
                    if (err3) return res.status(500).send("Booking error");

                    // Calculate remaining seats for each type
                    const ticketData = tickets.map(ticket => {
                        const booked = bookings.find(b => b.ticket_type === ticket.type);
                        const remaining = ticket.quantity - (booked ? booked.booked : 0);
                        return { ...ticket, remaining };
                    });

                    res.render('workshop_detail', {
                        event,
                        tickets: ticketData
                    });
                }
            );
        });
    });
});
// END

// =============================================================================
// POST: Reserve Seats
// Purpose: Create a new reservation for workshop seats
// Input: Workshop ID from params, guest info and seat quantities from body
// Output: Validates availability, creates booking, redirects to confirmation
// =============================================================================
router.post('/event/:id/book', (req, res) => {
    const eventId = req.params.id;
    const name = req.body.attendee_name.trim();
    const email = req.body.attendee_email ? req.body.attendee_email.trim() : null;
    const dietaryNotes = req.body.dietary_notes ? req.body.dietary_notes.trim() : null;
    const fullQty = parseInt(req.body.full_quantity) || 0;
    const concessionQty = parseInt(req.body.concession_quantity) || 0;
    const now = new Date().toISOString();

    // Validation: name and at least one seat required
    if (!name || (fullQty === 0 && concessionQty === 0)) {
        req.flash('error', 'Name and at least one seat are required.');
        return res.redirect('/attendee/event/' + eventId);
    }

    // Get current ticket availability
    db.all('SELECT * FROM tickets WHERE event_id = ?', [eventId], (err, tickets) => {
        if (err) return res.status(500).send("Seat check failed");

        // Get current bookings to calculate remaining
        db.all(
            'SELECT ticket_type, SUM(quantity) as booked FROM bookings WHERE event_id = ? GROUP BY ticket_type',
            [eventId],
            (err2, bookings) => {
                if (err2) return res.status(500).send("Booking check failed");

                // Calculate available seats
                const ticketMap = {};
                tickets.forEach(t => {
                    const booked = bookings.find(b => b.ticket_type === t.type);
                    ticketMap[t.type] = t.quantity - (booked ? booked.booked : 0);
                });

                // Check if requested seats are available
                if (fullQty > (ticketMap.full || 0) || concessionQty > (ticketMap.concession || 0)) {
                    req.flash('error', 'Not enough seats available.');
                    return res.redirect('/attendee/event/' + eventId);
                }

                // Prepare insert statement with email and dietary notes
                const insert = db.prepare(`
                    INSERT INTO bookings (event_id, attendee_name, attendee_email, ticket_type, quantity, booking_date, dietary_notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);

                // Insert standard seat booking if any
                if (fullQty > 0) {
                    insert.run(eventId, name, email, 'full', fullQty, now, dietaryNotes);
                }
                
                // Insert student/senior seat booking if any
                if (concessionQty > 0) {
                    insert.run(eventId, name, email, 'concession', concessionQty, now, dietaryNotes);
                }

                insert.finalize(() => {
                    req.flash('success', 'Seats reserved successfully!');
                    res.redirect(`/attendee/confirmation/${eventId}?name=${encodeURIComponent(name)}`);
                });
            }
        );
    });
});

// =============================================================================
// GET: Reservation Confirmation
// Purpose: Display confirmation page after successful booking
// Input: Workshop ID from params, guest name from query
// Output: Renders confirmation with booking details and totals
// =============================================================================
router.get('/confirmation/:id', (req, res) => {
    const eventId = req.params.id;
    const attendeeName = req.query.name;

    // Get workshop info
    db.get('SELECT * FROM events WHERE event_id = ?', [eventId], (err, event) => {
        if (err || !event) {
            req.flash('error', 'Workshop not found');
            return res.redirect('/attendee');
        }

        // Get this guest's bookings for this workshop
        db.all(`
            SELECT ticket_type, quantity, booking_date
            FROM bookings
            WHERE event_id = ? AND attendee_name = ?
        `, [eventId, attendeeName], (err2, bookings) => {
            if (err2 || bookings.length === 0) {
                req.flash('error', 'No reservations found');
                return res.redirect('/attendee');
            }

            // Get seat prices for calculating total
            db.all('SELECT type, price FROM tickets WHERE event_id = ?', [eventId], (err3, tickets) => {
                if (err3) return res.status(500).send("Price lookup failed");

                // Build price map
                const priceMap = {};
                tickets.forEach(t => priceMap[t.type] = t.price);

                // Calculate totals
                let totalQuantity = 0;
                let totalPrice = 0;

                bookings.forEach(b => {
                    totalQuantity += b.quantity;
                    totalPrice += b.quantity * (priceMap[b.ticket_type] || 0);
                });

                res.render('receipt', {
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

module.exports = router;
