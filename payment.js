// --- START OF FILE payment.js (Corrected Again) ---
let currentUserDetails = null;

document.addEventListener('DOMContentLoaded', () => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        currentUserDetails = JSON.parse(storedUser);
    }

    const bookingDetailsFromStorage = JSON.parse(localStorage.getItem('bookingDetails'));

    if (!bookingDetailsFromStorage || !bookingDetailsFromStorage.movieId) {
        document.getElementById('paymentForm').innerHTML = `
            <h2>Error</h2>
            <p>No booking details found. Please select a movie and seats first.</p>
            <button onclick="window.location.href='index.html'">Go to Home</button>
        `;
        return;
    }

    const { movieTitle, selectedShowtime, selectedSeats, totalAmount } = bookingDetailsFromStorage;

    // Ensure these elements exist before trying to set their innerHTML
    const bookingSummaryEl = document.getElementById('bookingSummary');
    const totalAmountEl = document.getElementById('totalAmount');

    if (bookingSummaryEl) {
        bookingSummaryEl.innerHTML = `
            <h3>Booking Summary</h3>
            <p><strong>Movie:</strong> ${movieTitle || 'N/A'}</p>
            <p><strong>Showtime:</strong> ${selectedShowtime || 'N/A'}</p>
            <p><strong>Seats:</strong> ${selectedSeats ? selectedSeats.join(', ') : 'None'}</p>
        `;
    }
    if (totalAmountEl) {
        totalAmountEl.innerHTML = `<strong>Total Amount: NRS ${totalAmount ? totalAmount.toFixed(2) : '0.00'}</strong>`;
    }


    const paymentMethodSelect = document.getElementById('paymentMethod');
    if (paymentMethodSelect) {
        paymentMethodSelect.addEventListener('change', function() {
            const cardDetails = document.getElementById('cardDetails');
            const esewaDetails = document.getElementById('esewaDetails'); // CORRECTED: Removed "минералы"
            
            const esewaNumberInput = document.getElementById('esewaNumber');
            const cardNumberInput = document.getElementById('cardNumber');
            const cardHolderInput = document.getElementById('cardHolder');
            const expiryDateInput = document.getElementById('expiryDate');
            const cvvInput = document.getElementById('cvv');

            if (this.value === 'esewa') {
                if(esewaNumberInput) esewaNumberInput.required = true;
                if(cardNumberInput) cardNumberInput.required = false;
                if(cardHolderInput) cardHolderInput.required = false;
                if(expiryDateInput) expiryDateInput.required = false;
                if(cvvInput) cvvInput.required = false;
                if(cardDetails) cardDetails.style.display = 'none';
                if(esewaDetails) esewaDetails.style.display = 'block';
            } else { // card
                if(esewaNumberInput) esewaNumberInput.required = false;
                if(cardNumberInput) cardNumberInput.required = true;
                if(cardHolderInput) cardHolderInput.required = true;
                if(expiryDateInput) expiryDateInput.required = true;
                if(cvvInput) cvvInput.required = true;
                if(cardDetails) cardDetails.style.display = 'block';
                if(esewaDetails) esewaDetails.style.display = 'none';
            }
        });
    }
     // Initialize required attributes based on default selection (card)
    document.getElementById('cardNumber').required = true;
    document.getElementById('cardHolder').required = true;
    document.getElementById('expiryDate').required = true;
    document.getElementById('cvv').required = true;
    document.getElementById('esewaNumber').required = false;
});


async function processPayment() {
    const payNowButton = document.getElementById('payNowButton');
    const bookingDetailsFromStorage = JSON.parse(localStorage.getItem('bookingDetails'));

    if (!bookingDetailsFromStorage) {
        alert("Critical error: Booking details missing. Please restart the booking process.");
        window.location.href = 'index.html';
        return;
    }

    const paymentMethod = document.getElementById('paymentMethod').value;
    let isValidForCard = false;

    if (paymentMethod === 'card') {
        const cardNumber = document.getElementById('cardNumber').value;
        const cardHolder = document.getElementById('cardHolder').value;
        const expiryDate = document.getElementById('expiryDate').value;
        const cvv = document.getElementById('cvv').value;
        isValidForCard = cardNumber.length >= 15 && cardNumber.length <= 19 &&
                  cardHolder.trim() !== '' &&
                  expiryDate.match(/^(0[1-9]|1[0-2])\/\d{2}$/) &&
                  cvv.match(/^\d{3,4}$/);
        if (!isValidForCard) {
            alert('Please fill in all card details correctly.');
            return;
        }
    }

    payNowButton.disabled = true;
    payNowButton.textContent = 'Processing...';

    let actualBookingId;
    try {
        const pendingBookingPayload = {
            movieId: bookingDetailsFromStorage.movieId,
            movieTitle: bookingDetailsFromStorage.movieTitle,
            selectedSeats: bookingDetailsFromStorage.selectedSeats,
            selectedShowtime: bookingDetailsFromStorage.selectedShowtime,
            totalAmount: bookingDetailsFromStorage.totalAmount,
            userId: currentUserDetails ? currentUserDetails.id : 'guest',
            paymentMethod: paymentMethod,
            paymentStatus: 'Pending'
        };

        const bookingResponse = await fetch('http://localhost:3000/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pendingBookingPayload),
        });
        const bookingResult = await bookingResponse.json();

        if (!bookingResponse.ok) {
            throw new Error(bookingResult.error || 'Failed to create pending booking. Seat conflict or server error.');
        }
        actualBookingId = bookingResult.booking._id;

    } catch (error) {
        console.error('Error creating pending booking:', error);
        alert(error.message);
        payNowButton.disabled = false;
        payNowButton.textContent = 'Pay Now';
        return;
    }

    if (paymentMethod === 'card') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
            const finalCardBookingPayload = {
                paymentGatewayRefId: 'CARD_SIM_' + Date.now()
            };
            const finalResponse = await fetch(`http://localhost:3000/bookings/${actualBookingId}/complete-card`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalCardBookingPayload)
            });
            const finalResult = await finalResponse.json();

            if (!finalResponse.ok) {
                throw new Error(finalResult.error || 'Card payment finalization failed.');
            }
            alert(`Card Payment Successful! Booking Confirmed.\nBooking ID: ${actualBookingId}`);
            localStorage.removeItem('bookingDetails');
            localStorage.setItem('lastBookingId', actualBookingId);
            window.location.href = `ticket.html`;
        } catch (error) {
            console.error('Error finalizing card payment:', error);
            alert(error.message);
            payNowButton.disabled = false;
            payNowButton.textContent = 'Pay Now';
        }

    } else if (paymentMethod === 'esewa') {
        try {
            const esewaPrepareResponse = await fetch('http://localhost:3000/payment/esewa/prepare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingId: actualBookingId,
                    totalAmount: bookingDetailsFromStorage.totalAmount
                })
            });
            const esewaPrepareData = await esewaPrepareResponse.json();

            if (!esewaPrepareResponse.ok) {
                throw new Error(esewaPrepareData.error || 'Failed to get eSewa payment details from server.');
            }

            const { esewaFormSubmitUrl, formData } = esewaPrepareData;
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = esewaFormSubmitUrl;
            form.style.display = 'none';

            for (const key in formData) {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = formData[key];
                form.appendChild(input);
            }
            document.body.appendChild(form);
            localStorage.removeItem('bookingDetails');
            console.log("Submitting form to eSewa with data:", formData);
            form.submit();
        } catch (error) {
            console.error('Error during eSewa payment initiation:', error);
            alert(error.message);
            payNowButton.disabled = false;
            payNowButton.textContent = 'Pay Now';
        }
    }
}
// --- END OF FILE payment.js ---