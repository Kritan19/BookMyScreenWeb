// --- START OF FILE script.js ---
let currentUser = null; // Stores { id, email, isAdmin } from backend
let editingMovieId = null;
window.moviesData = [];

document.addEventListener('DOMContentLoaded', () => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        showMainContent();
    } else {
        showAuthContent();
    }
});

function showAuthContent() {
    document.getElementById('authContainer').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
}

function showMainContent() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    if (currentUser) { // Ensure currentUser is not null
        document.getElementById('currentUserDisplay').textContent = `Logged in as: ${currentUser.email}`;
        if (currentUser.isAdmin) {
            document.getElementById('adminSection').style.display = 'block';
        } else {
            document.getElementById('adminSection').style.display = 'none';
        }
        loadMovies();
    } else { // Should not happen if logic is correct, but as a fallback
        showAuthContent();
    }
}

function showLogin() {
    document.getElementById('signup').style.display = 'none';
    document.getElementById('login').style.display = 'block';
    document.getElementById('loginError').textContent = '';
    document.getElementById('signupError').textContent = '';
}

function showSignup() {
    document.getElementById('login').style.display = 'none';
    document.getElementById('signup').style.display = 'block';
    document.getElementById('loginError').textContent = '';
    document.getElementById('signupError').textContent = '';
}

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorP = document.getElementById('loginError');
    errorP.textContent = '';
    const loginButton = document.querySelector('#login button[onclick="login()"]');
    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';


    try {
        const response = await fetch('http://localhost:3000/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP error! Status: ${response.status}`);
        }

        currentUser = data.user; // Store { id, email, isAdmin }
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showMainContent();

    } catch (error) {
        console.error('Login error:', error);
        errorP.textContent = error.message || 'Login failed. Please try again.';
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
    }
}

async function signup() {
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const errorP = document.getElementById('signupError');
    errorP.textContent = '';
    const signupButton = document.querySelector('#signup button[onclick="signup()"]');
    signupButton.disabled = true;
    signupButton.textContent = 'Signing up...';


    try {
        const response = await fetch('http://localhost:3000/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP error! Status: ${response.status}`);
        }

        alert(data.message || 'Signup successful! Please login.');
        showLogin(); // Go to login page after successful signup

    } catch (error) {
        console.error('Signup error:', error);
        errorP.textContent = error.message || 'Signup failed. Please try again.';
    } finally {
        signupButton.disabled = false;
        signupButton.textContent = 'Sign Up';
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    window.moviesData = [];
    document.getElementById('movies').innerHTML = '';
    document.getElementById('bookingsDisplayArea').style.display = 'none';
    document.getElementById('adminForm').style.display = 'none';
    showAuthContent();
}

// --- Movie Functions (loadMovies, bookTicket, Admin Functions) ---
// These should remain largely the same as in the "complete set" I provided earlier.
// Make sure loadMovies, bookTicket, showAdminForm, hideAdminForm, addOrUpdateMovie,
// editMovie, deleteMovie, viewAllBookings are present and correct.
// I'll re-paste them here for completeness, assuming they were correct from the previous full update.

function loadMovies() {
    const moviesGrid = document.getElementById('movies');
    moviesGrid.innerHTML = '<p>Loading movies...</p>';

    fetch('http://localhost:3000/movies')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(movies => {
            window.moviesData = movies;
            moviesGrid.innerHTML = '';
            if (!movies || movies.length === 0) {
                moviesGrid.innerHTML = '<p>No movies available at the moment.</p>';
                return;
            }
            movies.forEach(movie => {
                const div = document.createElement('div');
                div.className = 'movie-card';
                div.innerHTML = `
                    <img src="${movie.imageUrl || 'https://via.placeholder.com/300x450?text=No+Image'}" alt="${movie.title}">
                    <h3>${movie.title}</h3>
                    <p class="movie-showtimes">Showtimes: ${movie.showtimes.join(', ')}</p>
                    ${currentUser && !currentUser.isAdmin ? `<button class="book-button" onclick="bookTicket('${movie._id}')">Book Ticket</button>` : ''}
                    ${currentUser && currentUser.isAdmin ? `
                        <div class="admin-movie-actions">
                            <button onclick="editMovie('${movie._id}')">Edit</button>
                            <button onclick="deleteMovie('${movie._id}')" class="delete-button">Delete</button>
                        </div>
                    ` : ''}
                `;
                moviesGrid.appendChild(div);
            });
        })
        .catch(error => {
            console.error('Error loading movies:', error);
            moviesGrid.innerHTML = `<p>Error loading movies: ${error.message}. Please try again later.</p>`;
        });
}

function bookTicket(movieId) {
    window.location.href = `booking.html?movieId=${movieId}`;
}

function showAdminForm() {
    document.getElementById('adminForm').style.display = 'block';
    if (!editingMovieId) {
        document.getElementById('movieTitle').value = '';
        document.getElementById('movieDescription').value = '';
        document.getElementById('movieShowtimes').value = '';
        document.getElementById('movieImageUrl').value = '';
        document.getElementById('adminForm').querySelector('h2').textContent = 'Add Movie';
    }
}

function hideAdminForm() {
    document.getElementById('adminForm').style.display = 'none';
    editingMovieId = null;
}

function addOrUpdateMovie() {
    const title = document.getElementById('movieTitle').value;
    const description = document.getElementById('movieDescription').value;
    const showtimesInput = document.getElementById('movieShowtimes').value;
    const imageUrl = document.getElementById('movieImageUrl').value;

    if (!title || !showtimesInput) {
        alert('Title and Showtimes are required.');
        return;
    }
    const showtimes = showtimesInput.split(',').map(s => s.trim()).filter(s => s);

    const movieData = { title, description, showtimes, imageUrl };
    const method = editingMovieId ? 'PUT' : 'POST';
    const url = editingMovieId ? `http://localhost:3000/movies/${editingMovieId}` : 'http://localhost:3000/movies';

    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movieData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || `HTTP error! Status: ${response.status}`) });
        }
        return response.json();
    })
    .then(() => {
        alert(`Movie ${editingMovieId ? 'updated' : 'added'} successfully!`);
        hideAdminForm();
        loadMovies();
        editingMovieId = null;
    })
    .catch(error => {
        console.error(`Error ${editingMovieId ? 'updating' : 'adding'} movie:`, error);
        alert(`Error: ${error.message}`);
    });
}

function editMovie(movieId) {
    const movie = window.moviesData.find(m => m._id === movieId);
    if (movie) {
        editingMovieId = movieId;
        document.getElementById('movieTitle').value = movie.title;
        document.getElementById('movieDescription').value = movie.description || '';
        document.getElementById('movieShowtimes').value = movie.showtimes.join(', ');
        document.getElementById('movieImageUrl').value = movie.imageUrl || '';
        document.getElementById('adminForm').querySelector('h2').textContent = 'Edit Movie';
        showAdminForm();
        document.getElementById('adminForm').scrollIntoView({ behavior: 'smooth' });
    } else {
        console.error('Movie not found for editing:', movieId);
    }
}

function deleteMovie(movieId) {
    if (confirm('Are you sure you want to delete this movie?')) {
        fetch(`http://localhost:3000/movies/${movieId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || `HTTP error! Status: ${response.status}`) });
            }
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                return response.json();
            } else {
                return { message: "Movie deleted successfully (no content)" };
            }
        })
        .then(data => {
            alert(data.message || 'Movie deleted successfully!');
            loadMovies();
        })
        .catch(error => {
            console.error('Error deleting movie:', error);
            alert(`Failed to delete the movie. Error: ${error.message}`);
        });
    }
}

async function viewAllBookings() {
    const displayArea = document.getElementById('bookingsDisplayArea');
    const container = document.getElementById('bookingsTableContainer');
    displayArea.style.display = 'block';
    container.innerHTML = '<p>Loading bookings...</p>';
    displayArea.scrollIntoView({ behavior: 'smooth' });

    try {
        const response = await fetch('http://localhost:3000/admin/bookings');
        if (!response.ok) {
            const errText = await response.text(); // Get raw text to see what server sent
            console.error("Raw error response from /admin/bookings:", errText);
            let errJson = { error: `HTTP error! Status: ${response.status}. Response: ${errText.substring(0,100)}...`};
            try { errJson = JSON.parse(errText); } catch(e) { /* ignore if not json */ }
            throw new Error(errJson.error || `HTTP error! Status: ${response.status}`);
        }
        const bookings = await response.json();

        if (!bookings || bookings.length === 0) {
            container.innerHTML = '<p>No bookings found.</p>';
            return;
        }

        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Booking ID</th>
                        <th>Movie</th>
                        <th>Showtime</th>
                        <th>Seats</th>
                        <th>Amount</th>
                        <th>User ID</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
        `;
        bookings.forEach(booking => {
            tableHTML += `
                <tr>
                    <td>${booking._id}</td>
                    <td>${booking.movieTitle}</td>
                    <td>${booking.selectedShowtime}</td>
                    <td>${booking.selectedSeats.join(', ')}</td>
                    <td>NRS ${booking.totalAmount.toFixed(2)}</td>
                    <td>${booking.userId || 'N/A'}</td>
                    <td>${new Date(booking.bookingTime).toLocaleString()}</td>
                </tr>
            `;
        });
        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;

    } catch (error) {
        console.error('Error fetching bookings:', error);
        container.innerHTML = `<p>Error loading bookings: ${error.message}</p>`;
    }
}
// --- END OF FILE script.js ---