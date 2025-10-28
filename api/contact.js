/**
 * Vercel Serverless Function for Portfolio Contact Form
 * Saves submission to Firebase Firestore ONLY.
 * Handles POST requests only. Reads secrets from Environment Variables.
 * Uses CommonJS module syntax (`require`, `module.exports`).
 * Brevo code removed for EmailJS implementation on the client-side.
 */

const admin = require('firebase-admin');

// --- Firebase Admin Initialization ---
let db;
try {
    // Check if Firebase Admin is already initialized to prevent errors on hot reloads
    if (!admin.apps.length) {
        // Ensure the service account key is provided via environment variable
        if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
             throw new Error("Firebase Service Account JSON (FIREBASE_SERVICE_ACCOUNT) is not configured in environment variables.");
        }
        // Parse the service account key from the environment variable
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        // Initialize the Firebase Admin SDK
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin Initialized");
    } else {
        // Use the already initialized app
        admin.app();
        console.log("Firebase Admin already initialized");
    }
    // Get a reference to the Firestore database
    db = admin.firestore();
} catch (error) {
    // Log any errors during initialization
    console.error('Firebase Admin Initialization Error:', error);
    db = null; // Set db to null if initialization fails
}
// ------------------------------------


// --- Main Handler Function ---
module.exports = async (req, res) => {
    // 1. Set CORS headers to allow requests from your website
    res.setHeader('Access-Control-Allow-Credentials', true);
    // IMPORTANT: Replace '*' with your actual Vercel domain in production for security
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle browsers' preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. Only allow POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // 3. Get form data from the request body
    const { name, email, message } = req.body;

    // Basic validation: Check if required fields are present
    if (!name || !email || !message) {
        console.error("Validation Error: Missing required fields", req.body);
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if Firebase was initialized successfully
    if (!db) {
        console.error("Firestore Error: Database not initialized.");
        return res.status(500).json({ success: false, error: "Firestore Database connection failed." });
    }

    // 4. Save data to Firestore
    try {
        // Get a reference to the 'contact-submissions' collection and create a new document
        const submissionRef = db.collection('contact-submissions').doc();
        // Set the data for the new document, including a server timestamp
        await submissionRef.set({
            name: name,
            email: email,
            message: message,
            timestamp: admin.firestore.FieldValue.serverTimestamp(), // Use server timestamp
        });
        console.log("Successfully saved to Firestore, ID:", submissionRef.id);
        // Return a success response
        return res.status(200).json({ success: true, message: 'Message saved successfully!', id: submissionRef.id });
    } catch (error) {
        // Log any errors during the Firestore save operation
        console.error("Error saving to Firestore:", error);
        // Return a server error response
        return res.status(500).json({ success: false, error: error.message || 'Failed to save message to database.' });
    }
};

