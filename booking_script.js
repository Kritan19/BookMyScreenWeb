// --- START OF FILE booking_script.js ---
let selectedMovieForBooking = null;
let currentSelectedSeats = [];
let selectedShowtimeForBooking = null;
const PRICE_PER_SEAT = 150; // Define price per seat

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const movieId = urlParams.get('movieId');
    const seatPriceInfoP = document.getElementById('seatPriceInfo');
    seatPriceInfoP.textContent = `Price per seat: NRS ${PRICE_PER_SEAT.toFixed(2)}`;


    if (movieId) {
        fetch(`http://localhost:3000/movies/${movieId}`)
            .then(response => {
                if (!response.ok) throw new Error(`Failed to fetch movie details: ${response.status}`);
                return response.json();
            })
            .then(movie => {
                selectedMovieForBooking = movie;
                document.querySelector('#bookingSection h2').textContent = `Select Your Seat for ${movie.title}`;
                const showtimeSelect = document.getElementById('showtimeSelect');
                showtimeSelect.innerHTML = '<option value="">Select Showtime</option>'; // Default option
                movie.showtimes.forEach(time => {
                    const option = document.createElement('option');
                    option.value = time;
                    option.textContent = time;
                    showtimeSelect.appendChild(option);
                });

                showtimeSelect.addEventListener('change', (event) => {
                    selectedShowtimeForBooking = event.target.value;
                    currentSelectedSeats = []; // Reset seats on showtime change
                    if (selectedShowtimeForBooking) {
                        renderSeatMap(selectedMovieForBooking._id, selectedShowtimeForBooking);
                    } else {
                        document.getElementById('seatMap').innerHTML = '<p>Please select a showtime to see available seats.</p>';
                    }
                    updateLegendAndButton();
                });
            }).catch(error => {
                console.error('Error loading movie details for booking:', error);
                document.getElementById('bookingSection').innerHTML = `<p>Error loading movie: ${error.message}. <a href="index.html">Go Home</a></p>`;
            });
    } else {
        document.getElementById('bookingSection').innerHTML = '<p>No movie selected. Please <a href="index.html">go back</a> and select a movie.</p>';
    }
});

async function fetchReservedSeats(movieId, showtime) {
    const seatMapContainer = document.getElementById('seatMapContainer');
    seatMapContainer.querySelector('#seatMap').innerHTML = '<p>Loading seat availability...</p>';
    try {
        const response = await fetch(`http://localhost:3000/bookings/status/${movieId}/${encodeURIComponent(showtime)}`);
        if (!response.ok) {
            // Try to parse error from backend, or use default
            let errorMsg = `Failed to fetch reserved seats: ${response.status}`;
            try {
                const errData = await response.json();
                errorMsg = errData.error || errorMsg;
            } catch (e) {/* ignore parsing error */}
            throw new Error(errorMsg);
        }
        const data = await response.json();
        return data.reservedSeats || []; // Expects { reservedSeats: ['A1', 'B2'] }
    } catch (error) {
        console.error('Error in fetchReservedSeats:', error);
        seatMapContainer.querySelector('#seatMap').innerHTML = `<p style="color:red;">Error loading seats: ${error.message}</p>`;
        return []; // Return empty on error to prevent breaking seat map rendering
    }
}

async function renderSeatMap(movieId, showtime) {
    const seatMap = document.getElementById('seatMap');
    seatMap.innerHTML = ''; // Clear previous map or message

    const screenDiv = document.createElement('div');
    screenDiv.className = 'screen';
    seatMap.appendChild(screenDiv);

    const reservedSeatsForShowtime = await fetchReservedSeats(movieId, showtime);
    if (document.getElementById('seatMap').innerHTML.includes('Error loading seats')) {
      return; // Stop if fetchReservedSeats already put an error message.
    }


    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const seatsPerRow = 10;

    for (let i = 0; i < rows.length; i++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'row';
        for (let j = 0; j < seatsPerRow; j++) {
            const seatId = rows[i] + (j + 1);
            const seatDiv = document.createElement('div');
            seatDiv.className = 'seat';
            seatDiv.textContent = seatId;
            seatDiv.dataset.seatId = seatId; // Store seat ID for easy access

            if (reservedSeatsForShowtime.includes(seatId)) {
                seatDiv.classList.add('reserved');
            } else {
                seatDiv.classList.add('available');
                // If seat was previously selected (e.g. user changes showtime and comes back)
                if (currentSelectedSeats.includes(seatId)) {
                    seatDiv.classList.remove('available');
                    seatDiv.classList.add('selected');
                }
                seatDiv.onclick = () => toggleSeatSelection(seatDiv);
            }
            rowDiv.appendChild(seatDiv);
        }
        seatMap.appendChild(rowDiv);
    }
    updateLegendAndButton();
}

function toggleSeatSelection(seatDiv) {
    if (seatDiv.classList.contains('reserved')) return;

    const seatId = seatDiv.dataset.seatId;
    const isSelected = seatDiv.classList.toggle('selected');
    seatDiv.classList.toggle('available', !isSelected);

    if (isSelected) {
        currentSelectedSeats.push(seatId);
    } else {
        currentSelectedSeats = currentSelectedSeats.filter(s => s !== seatId);
    }
    updateLegendAndButton();
}

function updateLegendAndButton() {
    const confirmBtn = document.getElementById('confirmBookingButton');
    const totalPrice = currentSelectedSeats.length * PRICE_PER_SEAT;

    if (currentSelectedSeats.length > 0 && selectedShowtimeForBooking) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = `Confirm ${currentSelectedSeats.length} Seat(s) - NRS ${totalPrice.toFixed(2)}`;
    } else {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Confirm Selection';
    }
}

function confirmBookingAndProceed() {
    if (!selectedMovieForBooking || !selectedShowtimeForBooking || currentSelectedSeats.length === 0) {
        alert('Please select a showtime and at least one seat.');
        return;
    }

    const bookingDetails = {
        movieId: selectedMovieForBooking._id,
        movieTitle: selectedMovieForBooking.title,
        selectedShowtime: selectedShowtimeForBooking,
        selectedSeats: currentSelectedSeats,
        totalAmount: currentSelectedSeats.length * PRICE_PER_SEAT
    };

    localStorage.setItem('bookingDetails', JSON.stringify(bookingDetails));
    window.location.href = 'payment.html';
}
