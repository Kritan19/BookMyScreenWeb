// --- START OF FILE server.js ---
require('dotenv').config(); // Load environment variables FIRST
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const cryptoJs = require('crypto-js'); // For HMAC SHA256
const { v4: uuidv4 } = require('uuid'); // For generating unique PID

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB Atlas');
    }).catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// --- Schemas and Models ---
const movieSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    showtimes: { type: [String], required: true },
    imageUrl: String
});
const Movie = mongoose.model('Movie', movieSchema);

const bookingSchema = new mongoose.Schema({
    movieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
    movieTitle: { type: String, required: true },
    userId: { type: String, default: 'guest' },
    selectedSeats: { type: [String], required: true },
    selectedShowtime: { type: String, required: true },
    totalAmount: { type: Number, required: true },
    paymentStatus: { type: String, default: 'Pending', enum: ['Pending', 'Completed', 'Failed', 'Cancelled'] },
    bookingTime: { type: Date, default: Date.now },
    paymentGatewayRefId: String, // e.g., eSewa's transaction_code
    transactionUuid: { type: String, required: true, unique: true }, // Our unique PID for eSewa
});
const Booking = mongoose.model('Booking', bookingSchema);

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);


// --- Helper Function for Error Responses ---
function handleError(res, error, message = "Server error", statusCode = 500) {
    console.error(message + ": ", error.message || error);
    if (res.headersSent) return;
    res.status(statusCode).json({ error: message, details: String(error.message || error) });
}

// --- Authentication Endpoints ---
app.post('/auth/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
        if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Invalid email format.' });
        if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters long.' });

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) return res.status(409).json({ error: 'Email already in use.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const isAdmin = (email.toLowerCase() === 'admin@example.com');
        const newUser = new User({ email: email.toLowerCase(), password: hashedPassword, isAdmin: isAdmin });
        await newUser.save();
        res.status(201).json({ message: 'User created successfully.', user: { id: newUser._id, email: newUser.email, isAdmin: newUser.isAdmin }});
    } catch (error) { handleError(res, error, 'Signup failed'); }
});

app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials.' });
        res.status(200).json({ message: 'Login successful.', user: { id: user._id, email: user.email, isAdmin: user.isAdmin }});
    } catch (error) { handleError(res, error, 'Login failed'); }
});


// --- Movie Endpoints ---
app.get('/movies', async (req, res) => { try { res.json(await Movie.find()); } catch (e) { handleError(res, e); } });
app.get('/movies/:id', async (req, res) => { try { if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' }); const m = await Movie.findById(req.params.id); if (!m) return res.status(404).json({error: 'Not Found'}); res.json(m); } catch (e) { handleError(res, e); } });
app.post('/movies', async (req, res) => { try { res.status(201).json(await new Movie(req.body).save()); } catch (e) { handleError(res, e, 'Add movie failed', 400); }});
app.put('/movies/:id', async (req, res) => { try { if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' }); const m = await Movie.findByIdAndUpdate(req.params.id, req.body, {new: true, runValidators: true}); if (!m) return res.status(404).json({error: 'Not Found'}); res.json(m); } catch (e) { handleError(res, e, 'Update movie failed', 400); }});
app.delete('/movies/:id', async (req, res) => { try { if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' }); const m = await Movie.findByIdAndDelete(req.params.id); if (!m) return res.status(404).json({error: 'Not Found'}); res.json({message: 'Movie Deleted'}); } catch (e) { handleError(res, e); }});

// --- Booking Endpoints ---
app.post('/bookings', async (req, res) => {
    try {
        const { movieId, movieTitle, selectedSeats, selectedShowtime, totalAmount, userId, paymentMethod } = req.body;
        let { paymentStatus } = req.body;


        if (!movieId || !movieTitle || !selectedSeats || selectedSeats.length === 0 || !selectedShowtime || totalAmount == null) {
            return res.status(400).json({ error: 'Missing required booking information.' });
        }
        if (!mongoose.Types.ObjectId.isValid(movieId)) {
            return res.status(400).json({ error: 'Invalid Movie ID format for booking.' });
        }

        // If payment method is card (simulated), it's completed. Otherwise, pending for eSewa.
        if (!paymentStatus) { // If paymentStatus is not explicitly passed
            paymentStatus = (paymentMethod === 'card') ? 'Completed' : 'Pending';
        }


        if (paymentStatus === 'Completed') { // Check for seat conflicts only if trying to complete booking
            const conflictingBooking = await Booking.findOne({
                movieId, selectedShowtime, selectedSeats: { $in: selectedSeats }, paymentStatus: 'Completed'
            });
            if (conflictingBooking) {
                const conflictingSeats = selectedSeats.filter(seat => conflictingBooking.selectedSeats.includes(seat));
                return res.status(409).json({ error: `Seat(s) ${conflictingSeats.join(', ')} already booked.` });
            }
        }
        const transactionUuid = uuidv4();

        const newBooking = new Booking({
            movieId, movieTitle, selectedSeats, selectedShowtime, totalAmount,
            userId: userId || 'guest',
            paymentStatus,
            transactionUuid // Store our unique ID for eSewa PID
        });
        await newBooking.save();
        res.status(201).json({ message: `Booking created with status: ${paymentStatus}`, booking: newBooking });
    } catch (error) {
        handleError(res, error, 'Failed to create booking');
    }
});

// Endpoint to complete a card payment (simulation)
app.put('/bookings/:bookingId/complete-card', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { paymentGatewayRefId } = req.body;

        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            return res.status(400).json({ error: 'Invalid booking ID format' });
        }
        const updatedBooking = await Booking.findByIdAndUpdate(
            bookingId,
            { paymentStatus: 'Completed', paymentGatewayRefId: paymentGatewayRefId || ('CARD_SIM_' + Date.now()) },
            { new: true }
        );
        if (!updatedBooking) return res.status(404).json({ error: 'Booking not found to complete.' });
        res.status(200).json({ message: 'Card payment booking completed', booking: updatedBooking });
    } catch (error) {
        handleError(res, error, 'Failed to complete card payment booking');
    }
});


app.get('/bookings/status/:movieId/:showtime', async (req, res) => {
    try {
        const { movieId, showtime } = req.params;
        if (!mongoose.Types.ObjectId.isValid(movieId)) return res.status(400).json({ error: 'Invalid movie ID' });
        const bookings = await Booking.find({ movieId, selectedShowtime: decodeURIComponent(showtime), paymentStatus: 'Completed' });
        let reservedSeats = [];
        bookings.forEach(b => { reservedSeats = reservedSeats.concat(b.selectedSeats);});
        res.json({ reservedSeats: [...new Set(reservedSeats)] });
    } catch (e) { handleError(res, e); }
});
app.get('/bookings/:bookingId', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.bookingId)) return res.status(400).json({ error: 'Invalid booking ID' });
        const booking = await Booking.findById(req.params.bookingId);
        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        res.json(booking);
    } catch (e) { handleError(res, e); }
});
app.get('/admin/bookings', async (req, res) => {
    try {
        res.json(await Booking.find().sort({ bookingTime: -1 }));
    } catch (e) { handleError(res, e); }
});


// --- eSewa Payment Endpoints (Following Video Logic) ---
app.post('/payment/esewa/prepare', async (req, res) => {
    try {
        const { bookingId } = req.body; // We get totalAmount from the booking record

        if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
            return res.status(400).json({ error: 'Valid Booking ID is required.' });
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found to initiate payment.' });
        }
        if (booking.paymentStatus === 'Completed') {
            return res.status(400).json({ error: 'This booking has already been paid.'});
        }

        const totalAmount = booking.totalAmount;
        const transaction_uuid = booking.transactionUuid; // Use the UUID from the booking document
        const product_code = process.env.ESEWA_MERCHANT_CODE; // For eSewa, product_code is often their merchant code

        // Message string for signature: "total_amount=AMOUNT,transaction_uuid=UUID,product_code=PRODUCT_CODE"
        // Order and keys MUST match what `signed_field_names` will contain.
        const message = `total_amount=${totalAmount},transaction_uuid=${transaction_uuid},product_code=${product_code}`;
        const secretKey = process.env.ESEWA_SECRET_KEY;

        const hash = cryptoJs.HmacSHA256(message, secretKey);
        const signature = cryptoJs.enc.Base64.stringify(hash);

        const esewaFormData = {
            // These field names are based on common eSewa V2 form submissions
            // and the video's implied parameters for the signature.
            // The video uses more descriptive names in its HTML form, but the signature message implies these keys.
            "amount": booking.totalAmount, // The actual amount of the product/service
            "tax_amount": "0",
            "total_amount": booking.totalAmount, // Total including tax, service, delivery
            "transaction_uuid": transaction_uuid, // Your unique ID for the transaction
            "product_code": product_code, // Usually your merchant code
            "product_service_charge": "0",
            "product_delivery_charge": "0",
            "success_url": `${process.env.SERVER_BASE_URL}/payment/esewa/callback/success`,
            "failure_url": `${process.env.SERVER_BASE_URL}/payment/esewa/callback/failure`,
            "signed_field_names": "total_amount,transaction_uuid,product_code", // Fields used for signature
            "signature": signature,
        };
        
        console.log("Preparing eSewa Data:", { messageForSig: message, generatedSignature: signature, formData: esewaFormData });

        res.status(200).json({
            esewaFormSubmitUrl: process.env.ESEWA_FORM_SUBMIT_URL,
            formData: esewaFormData
        });

    } catch (error) {
        handleError(res, error, 'Failed to prepare eSewa payment data');
    }
});

// Callback from eSewa after user interaction
app.get('/payment/esewa/callback/success', async (req, res) => {
    try {
        const { data } = req.query;
        if (!data) {
            console.error("eSewa success callback: Missing data parameter.");
            return res.redirect(`${process.env.APP_BASE_URL}/payment-failed.html?message=Invalid_eSewa_response`);
        }

        console.log("eSewa Success Callback - Raw Base64 Data:", data);
        const decodedString = Buffer.from(data, 'base64').toString('utf-8');
        console.log("eSewa Success Callback - Decoded String:", decodedString);
        const esewaResponse = JSON.parse(decodedString);
        console.log("eSewa Success Callback - Parsed JSON:", esewaResponse);

        // Construct message for signature verification from eSewa's response
        // The order and keys must match what eSewa specifies in esewaResponse.signed_field_names
        const fieldsForTheirSignature = esewaResponse.signed_field_names.split(',');
        let messageToVerify = "";
        fieldsForTheirSignature.forEach((field, index) => {
            messageToVerify += `${field}=${esewaResponse[field]}${index === fieldsForTheirSignature.length - 1 ? '' : ','}`;
        });

        const secretKey = process.env.ESEWA_SECRET_KEY;
        const calculatedSignature = cryptoJs.enc.Base64.stringify(cryptoJs.HmacSHA256(messageToVerify, secretKey));

        console.log("Message from eSewa for verification:", messageToVerify);
        console.log("Signature from eSewa:", esewaResponse.signature);
        console.log("Our calculated signature for verification:", calculatedSignature);

        if (calculatedSignature !== esewaResponse.signature) {
            console.error("eSewa signature verification failed: Signatures do not match.");
            await Booking.findOneAndUpdate( { transactionUuid: esewaResponse.transaction_uuid, paymentStatus: 'Pending' }, { paymentStatus: 'Failed' });
            return res.redirect(`${process.env.APP_BASE_URL}/payment-failed.html?message=Payment_verification_failed_(Signature_Mismatch)`);
        }

        if (esewaResponse.status.toUpperCase() !== "COMPLETE") {
            console.warn("eSewa payment status not COMPLETE. Status:", esewaResponse.status);
            await Booking.findOneAndUpdate( { transactionUuid: esewaResponse.transaction_uuid, paymentStatus: 'Pending' }, { paymentStatus: 'Failed' }); // Or map eSewa status
            return res.redirect(`${process.env.APP_BASE_URL}/payment-failed.html?message=Payment_not_completed_on_eSewa&status=${esewaResponse.status}`);
        }

        // Payment verified and complete
        const booking = await Booking.findOneAndUpdate(
            { transactionUuid: esewaResponse.transaction_uuid, paymentStatus: 'Pending' }, // Ensure we only update pending ones
            {
                paymentStatus: 'Completed',
                paymentGatewayRefId: esewaResponse.transaction_code 
            },
            { new: true }
        );

        if (!booking) {
            console.error("Booking not found for UUID or already processed:", esewaResponse.transaction_uuid);
            // Could be a re-attempt or an issue. If already completed, it's fine.
            const alreadyCompletedBooking = await Booking.findOne({ transactionUuid: esewaResponse.transaction_uuid, paymentStatus: 'Completed' });
            if (alreadyCompletedBooking) {
                return res.redirect(`${process.env.APP_BASE_URL}/ticket.html?bookingId=${alreadyCompletedBooking._id}&status=already_completed`);
            }
            return res.redirect(`${process.env.APP_BASE_URL}/payment-failed.html?message=Booking_record_update_issue`);
        }

        console.log("Booking successfully updated after eSewa payment:", booking._id);
        res.redirect(`${process.env.APP_BASE_URL}/ticket.html?bookingId=${booking._id}&status=esewa_success`);

    } catch (error) {
        console.error("Fatal error in eSewa success callback:", error);
        // Fallback redirect for unhandled errors
        res.redirect(`${process.env.APP_BASE_URL}/payment-failed.html?message=Server_error_during_payment_confirmation`);
    }
});

app.get('/payment/esewa/callback/failure', async (req, res) => {
    // eSewa usually sends back the 'pid' (our transaction_uuid) in the query on failure.
    // The video doesn't explicitly show the failure parameters, so we'll assume 'pid' or 'transaction_uuid'.
    const transactionId = req.query.pid || req.query.transaction_uuid || req.query.oid;
    console.log("eSewa Failure Callback Received for transactionId:", transactionId, "Full query:", req.query);

    if (transactionId) {
        await Booking.findOneAndUpdate(
            { transactionUuid: transactionId, paymentStatus: 'Pending' },
            { paymentStatus: 'Failed' } // Or 'Cancelled' depending on eSewa's reason if provided
        );
        console.log("Booking status updated to Failed/Cancelled for transaction ID:", transactionId);
    }
    res.redirect(`${process.env.APP_BASE_URL}/payment-failed.html?message=Payment_failed_or_cancelled_at_eSewa&transactionId=${transactionId || 'N/A'}`);
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
// --- END OF FILE server.js ---