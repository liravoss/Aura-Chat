// Common utility functions used across the client application

/**
 * Escapes HTML characters in a string to prevent XSS attacks.
 * @param {string} text - The raw text to escape.
 * @returns {string} The HTML-safe string.
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;', 
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Checks for a stored user and redirects if not found.
 * NOTE: In this client-side demo, it returns null instead of redirecting
 * if the function is called inside an event handler, to prevent issues.
 * @returns {Object|null} The user object or null.
 */
function getUserOrRedirect() {
  const user = JSON.parse(localStorage.getItem("aurachat_user") || "null");
  if (!user) {
    // If user is missing, log a warning and return null. The calling function
    // (e.g., in community.js) should handle the null return.
    console.warn("User not found in localStorage. Please create a profile.");
    return null;
  }
  return user;
}