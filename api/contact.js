/**
 * Vercel Serverless Function for Portfolio Contact Form
 * Saves submission to Firebase Firestore and sends email via Brevo.
 * Handles POST requests only. Reads secrets from Environment Variables.
 * Uses CommonJS module syntax (`require`, `module.exports`).
 */

const BrevoSDK = require("@getbrevo/brevo"); // Use documented import name
const admin = require('firebase-admin');

// --- Firebase Admin Initialization ---
try {
    // Check if Firebase Admin is already initialized (to prevent errors on hot reloads)
    if (!admin.apps.length) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin Initialized");
    } else {
        console.log("Firebase Admin already initialized");
    }
} catch (error) {
    console.error('Firebase Admin Initialization Error:', error);
    // We don't return here, maybe Brevo can still work, but log the critical error.
}
const db = admin.firestore();
// ------------------------------------


// --- Main Handler Function ---
module.exports = async (req, res) => {
    // 1. Allow CORS (Important for Vercel functions called from browser)
    // Adjust origin ('*') in production if needed for security
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Or your specific domain: 'https://yourdomain.com'
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. Check for POST request
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST', 'OPTIONS']); // Include OPTIONS in Allow header
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // 3. Get form data
    const { name, email, message } = req.body;

    // Basic validation
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // 4. Prepare Firestore and Brevo operations (run in parallel)
    const firestorePromise = saveToFirestore(name, email, message);
    const brevoPromise = sendBrevoEmail(name, email, message);

    try {
        // Wait for both operations to complete
        const [firestoreResult, brevoResult] = await Promise.all([firestorePromise, brevoPromise]);

        console.log("Firestore Result:", firestoreResult);
        console.log("Brevo Result:", brevoResult);

        // Check if both were successful (or handle partial success if needed)
        if (firestoreResult.success && brevoResult.success) {
            return res.status(200).json({ success: true, message: 'Message saved and email sent successfully!' });
        } else {
            // Construct a more informative error message
            let errorMessage = "Partial failure: ";
            if (!firestoreResult.success) errorMessage += `Firestore Error (${firestoreResult.error}). `;
            if (!brevoResult.success) errorMessage += `Brevo Email Error (${brevoResult.error}).`;
            console.error("Handler Error:", errorMessage);
            // Return 500 as it's a server-side issue
            return res.status(500).json({ success: false, error: errorMessage });
        }

    } catch (error) { // Catch any unexpected errors during Promise.all or setup
        console.error("Unexpected Error in contact form handler:", error);
        return res.status(500).json({ success: false, error: 'An unexpected server error occurred.' });
    }
};

// --- Helper Function: Save to Firestore ---
async function saveToFirestore(name, email, message) {
    try {
        const submissionRef = db.collection('contact-submissions').doc(); // Auto-generate ID
        await submissionRef.set({
            name: name,
            email: email,
            message: message,
            timestamp: admin.firestore.FieldValue.serverTimestamp(), // Use server timestamp
            userAgent: '', // User agent is typically available in req.headers['user-agent'] if needed
            ip: '', // IP address is typically available in req.headers['x-forwarded-for'] or req.connection.remoteAddress if needed
        });
        console.log("Successfully saved to Firestore, ID:", submissionRef.id);
        return { success: true, id: submissionRef.id };
    } catch (error) {
        console.error("Error saving to Firestore:", error);
        return { success: false, error: error.message || 'Firestore save failed' };
    }
}


// --- Helper Function: Send Email via Brevo ---
async function sendBrevoEmail(name, email, message) {
    try {
        // --- Configure Brevo Client ---
        // Accessing the SDK using the documented variable name
        if (!BrevoSDK || !BrevoSDK.ApiClient) {
             throw new Error("Brevo SDK or ApiClient not loaded correctly.");
        }
        
        let defaultClient = BrevoSDK.ApiClient.instance;
        if (!defaultClient) {
            throw new Error("Brevo ApiClient instance is not available.");
        }

        let apiKeyAuth = defaultClient.authentications["api-key"]; // Corrected variable name
        if (!apiKeyAuth) {
             throw new Error("Brevo API key authentication setup failed.");
        }
        
        // Ensure the environment variable is set
        if (!process.env.SENDINBLUE_API_KEY) {
            throw new Error("Brevo API Key (SENDINBLUE_API_KEY) is not configured in environment variables.");
        }
        apiKeyAuth.apiKey = process.env.SENDINBLUE_API_KEY; // Corrected variable name
        // -----------------------------

        const apiInstance = new BrevoSDK.TransactionalEmailsApi();
        const sendSmtpEmail = new BrevoSDK.SendSmtpEmail(); // Make sure to use BrevoSDK here too

        // Sender details (must be verified in Brevo)
        const SENDER_EMAIL = "harshitkumar9234@gmail.com";
        const SENDER_NAME = "Harshit Kumar (Portfolio)";

        // Email content
        sendSmtpEmail.subject = `New Portfolio Message from ${name}`;
        sendSmtpEmail.htmlContent = `
            <p>You received a new message from your portfolio contact form:</p>
            <hr>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Message:</strong></p>
            <p>${message}</p>
        `;
        sendSmtpEmail.sender = { email: SENDER_EMAIL, name: SENDER_NAME };
        sendSmtpEmail.to = [
            { email: "harshitkumar9234@gmail.com", name: "Harshit Kumar" }, // Send to yourself
        ];
        sendSmtpEmail.replyTo = { email: email, name: name }; // Set reply-to as the submitter

        // Send the email
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log("Brevo API called successfully. Result:", data);
        return { success: true, result: data };

    } catch (error) {
        console.error("Error sending email via Brevo:", error);
        return { success: false, error: error.message || 'Brevo email failed' };
    }
}

