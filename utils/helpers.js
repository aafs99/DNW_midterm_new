/**
 * utils/helpers.js
 * Shared Helper Functions
 * 
 * Purpose: Common utility functions used across multiple route modules
 * Used by: routes/organiser.js, routes/attendee.js, routes/login.js
 */

/**
 * sanitizeInput
 * Purpose: Basic XSS protection - removes angle brackets
 * Input: str (string)
 * Output: Sanitized string with < and > removed
 */
function sanitizeInput(str) {
    if (!str) return '';
    return str.replace(/[<>]/g, '');
}

/**
 * isValidEmail
 * Purpose: Validate email format (allows empty for optional fields)
 * Input: email (string)
 * Output: boolean - true if valid email format OR empty/null
 */
function isValidEmail(email) {
    if (!email) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * formatDate
 * Purpose: Convert ISO date string to readable UK format
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
 * formatDateShort
 * Purpose: Convert ISO date string to short readable format (no time)
 * Input: dateString (ISO format)
 * Output: Formatted string e.g. "15 Jan 2025"
 */
function formatDateShort(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
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
 * parsePositiveInt
 * Purpose: Safely parse a positive integer from input
 * Input: value (string or number)
 * Output: positive integer or 0 if invalid
 */
function parsePositiveInt(value) {
    const parsed = parseInt(value, 10);
    return (parsed > 0) ? parsed : 0;
}

module.exports = {
    sanitizeInput,
    isValidEmail,
    formatDate,
    formatDateShort,
    isValidFutureDate,
    parsePositiveInt
};