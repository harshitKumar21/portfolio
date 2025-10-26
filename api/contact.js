/**
 * Vercel Serverless Function for Portfolio Contact Form
 * Saves submission to Firebase Firestore and sends email via Brevo.
 * Handles POST requests only. Reads secrets from Environment Variables.
 * Uses CommonJS module syntax (`require`, `module.exports`).
 */

// --- DEBUGGING: Log right after require ---
let BrevoSDK;
try {
    BrevoSDK = require("@getbrevo/brevo");
    console.log("[DEBUG] BrevoSDK object after require:", BrevoSDK); // Log the entire object
    // Check specific properties
    console.log("[DEBUG] BrevoSDK.ApiClient:", BrevoSDK ? BrevoSDK.ApiClient : 'BrevoSDK is undefined');
    console.log("[DEBUG] BrevoSDK keys:", BrevoSDK ? Object.keys(BrevoSDK) : 'BrevoSDK is undefined'); // Log available keys
} catch (error) {
    console.error("[DEBUG] Failed to require @getbrevo/brevo:", error);
    // If require fails, the function will likely crash later, but log helps
}
// ------------------------------------------

const admin = require('firebase-admin');

// --- Firebase Admin Initialization ---
try {
    // Check if Firebase Admin is already initialized (to prevent errors on hot reloads)
    if (!admin.apps.length) {
        // Ensure FIREBASE_SERVICE_ACCOUNT is present
        if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
             throw new Error("Firebase Service Account JSON (FIREBASE_SERVICE_ACCOUNT) is not configured in environment variables.");
        }
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
    // If Firebase init fails, we might still try Brevo, but log the critical error.
}
const db = admin.firestore();
// ------------------------------------


// --- Main Handler Function ---
module.exports = async (req, res) => {
    // 1. Allow CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust in production
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. Check for POST request
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // 3. Get form data
    const { name, email, message } = req.body;

    // Basic validation
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // 4. Prepare Firestore and Brevo operations
    const firestorePromise = saveToFirestore(name, email, message);
    const brevoPromise = sendBrevoEmail(name, email, message);

    try {
        // Wait for both
        const [firestoreResult, brevoResult] = await Promise.all([firestorePromise, brevoPromise]);

        console.log("Firestore Result:", firestoreResult);
        console.log("Brevo Result:", brevoResult);

        // Check results
        if (firestoreResult.success && brevoResult.success) {
            return res.status(200).json({ success: true, message: 'Message saved and email sent successfully!' });
        } else {
            let errorMessage = "Partial failure: ";
            if (!firestoreResult.success) errorMessage += `Firestore Error (${firestoreResult.error}). `;
            if (!brevoResult.success) errorMessage += `Brevo Email Error (${brevoResult.error}).`;
            console.error("Handler Error:", errorMessage);
            return res.status(500).json({ success: false, error: errorMessage });
        }

    } catch (error) {
        console.error("Unexpected Error in contact form handler:", error);
        return res.status(500).json({ success: false, error: 'An unexpected server error occurred.' });
    }
};

// --- Helper Function: Save to Firestore ---
async function saveToFirestore(name, email, message) {
    try {
        // Ensure db object is valid before using it
        if (!db) {
            throw new Error("Firestore database instance (db) is not initialized.");
        }
        const submissionRef = db.collection('contact-submissions').doc();
        await submissionRef.set({
            name: name,
            email: email,
            message: message,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            // You can add headers later if needed:
            // userAgent: req.headers['user-agent'] || '',
            // ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || '',
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
        console.log("[DEBUG] Entering sendBrevoEmail function."); // Log entry

        // Accessing the SDK using the documented variable name
        if (!BrevoSDK) {
             console.error("[DEBUG] BrevoSDK is undefined or null at check.");
             throw new Error("Brevo SDK was not loaded correctly (likely require failed).");
        }
        if (!BrevoSDK.ApiClient) {
             console.error("[DEBUG] BrevoSDK.ApiClient is undefined. BrevoSDK keys:", Object.keys(BrevoSDK));
             throw new Error("Brevo SDK loaded, but ApiClient property is missing.");
        }
        console.log("[DEBUG] BrevoSDK.ApiClient seems available.");

        let defaultClient = BrevoSDK.ApiClient.instance;
        if (!defaultClient) {
            console.error("[DEBUG] BrevoSDK.ApiClient.instance is undefined.");
            throw new Error("Brevo ApiClient instance is not available.");
        }
        console.log("[DEBUG] defaultClient instance obtained.");

        let apiKeyAuth = defaultClient.authentications["api-key"];
        if (!apiKeyAuth) {
             console.error("[DEBUG] defaultClient.authentications['api-key'] is undefined.");
             throw new Error("Brevo API key authentication setup failed.");
        }
        console.log("[DEBUG] apiKeyAuth object obtained.");

        // Ensure the environment variable is set
        if (!process.env.SENDINBLUE_API_KEY) {
            console.error("[DEBUG] SENDINBLUE_API_KEY environment variable is missing.");
            throw new Error("Brevo API Key (SENDINBLUE_API_KEY) is not configured in environment variables.");
        }
        apiKeyAuth.apiKey = process.env.SENDINBLUE_API_KEY;
        console.log("[DEBUG] Brevo API Key assigned from environment variable.");
        // -----------------------------

        // Check if TransactionalEmailsApi exists
        if (!BrevoSDK.TransactionalEmailsApi) {
            console.error("[DEBUG] BrevoSDK.TransactionalEmailsApi is undefined.");
            throw new Error("Brevo TransactionalEmailsApi class is missing.");
        }
        const apiInstance = new BrevoSDK.TransactionalEmailsApi();
        console.log("[DEBUG] TransactionalEmailsApi instance created.");

        // Check if SendSmtpEmail exists
        if (!BrevoSDK.SendSmtpEmail) {
            console.error("[DEBUG] BrevoSDK.SendSmtpEmail is undefined.");
            throw new Error("Brevo SendSmtpEmail class is missing.");
        }
        const sendSmtpEmail = new BrevoSDK.SendSmtpEmail();
        console.log("[DEBUG] SendSmtpEmail instance created.");


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
        console.log("[DEBUG] Email object configured:", JSON.stringify(sendSmtpEmail));

        // Send the email
        console.log("[DEBUG] Calling apiInstance.sendTransacEmail...");
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log("Brevo API called successfully. Result:", data);
        return { success: true, result: data };

    } catch (error) {
        // Log the specific error before returning
        console.error("[DEBUG] Error caught in sendBrevoEmail:", error);
        return { success: false, error: error.message || 'Brevo email failed' };
    }
}

