// --- START OF FILE ticket.js (Updated) ---
document.addEventListener('DOMContentLoaded', () => {
    const ticketInfoDiv = document.getElementById('ticketInfo');
    let bookingId = null;

    // Priority 1: Get bookingId from URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    bookingId = urlParams.get('bookingId');

    // Priority 2: Fallback to localStorage (e.g., for client-side redirects like card payment)
    if (!bookingId) {
        console.log("Booking ID not found in URL, trying localStorage...");
        bookingId = localStorage.getItem('lastBookingId');
    }

    if (!bookingId) {
        ticketInfoDiv.innerHTML = `
            <p style="color:red;">Error: No booking ID found. Cannot display ticket.</p>
            <p><a href="index.html">Go to Homepage</a></p>
        `;
        // Clean up localStorage just in case, though it should have been null
        localStorage.removeItem('lastBookingId');
        return;
    }

    console.log("Displaying ticket for Booking ID:", bookingId);
    ticketInfoDiv.innerHTML = `<p>Loading ticket details for Booking ID: ${bookingId}...</p>`;

    // Fetch booking details from the server using the bookingId
    fetch(`http://localhost:3000/bookings/${bookingId}`)
        .then(response => {
            if (!response.ok) {
                // Try to parse error from backend, or use default
                return response.json().then(errData => {
                    throw new Error(errData.error || `Failed to fetch ticket details: ${response.status}`);
                }).catch(() => { // If parsing errData also fails
                    throw new Error(`Failed to fetch ticket details: ${response.status} and couldn't parse error.`);
                });
            }
            return response.json();
        })
        .then(booking => {
            if (booking && booking._id) { // Check if booking data is valid
                ticketInfoDiv.innerHTML = `
                    <p><strong>Booking ID:</strong> ${booking._id}</p>
                    <p><strong>Movie:</strong> ${booking.movieTitle}</p>
                    <p><strong>Showtime:</strong> ${booking.selectedShowtime}</p>
                    <p><strong>Seats:</strong> ${booking.selectedSeats.join(', ')}</p>
                    <p><strong>Total Amount:</strong> NRS ${booking.totalAmount.toFixed(2)}</p>
                    <p><strong>Booked On:</strong> ${new Date(booking.bookingTime).toLocaleString()}</p>
                    <p><strong>Payment Status:</strong> ${booking.paymentStatus}</p>
                    ${booking.paymentGatewayRefId ? `<p><strong>Gateway Ref:</strong> ${booking.paymentGatewayRefId}</p>` : ''}
                    <hr style="margin: 15px 0;">
                    <p style="margin-top:20px; font-weight:bold; text-align:center;">Thank you for booking with Book My Screen!</p>
                `;
            } else {
                // This case might happen if the bookingId was valid format but no record found
                throw new Error('Booking data not found or is invalid.');
            }
        })
        .catch(error => {
            console.error('Error loading ticket details:', error);
            ticketInfoDiv.innerHTML = `<p style="color:red;">Error loading ticket: ${error.message}</p>`;
        })
        .finally(() => {
            // Clean up lastBookingId from localStorage after attempting to use it or getting from URL
            // This ensures it's not accidentally reused for a different ticket page visit.
            localStorage.removeItem('lastBookingId');
        });
});

function printTicket() {
    window.print();
}
// --- END OF FILE ticket.js ---