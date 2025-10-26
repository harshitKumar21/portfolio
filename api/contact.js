/**
 * Vercel Serverless Function for Portfolio Contact Form
 * Saves submission to Firebase Firestore and sends email via Brevo.
 * Handles POST requests only. Reads secrets from Environment Variables.
 * Uses CommonJS module syntax (`require`, `module.exports`).
 */

// --- DEBUGGING: Log right after require ---
let BrevoSDK;
let BrevoAPI; // Variable to hold the actual SDK exports
try {
    BrevoSDK = require("@getbrevo/brevo");
    console.log("[DEBUG] Raw BrevoSDK object after require:", BrevoSDK); // Log the entire object

    // --- ATTEMPT TO FIND THE CORRECT EXPORTS ---
    // Sometimes CommonJS might wrap ESM default exports
    if (BrevoSDK && BrevoSDK.ApiClient) {
        BrevoAPI = BrevoSDK; // Looks like direct export worked
        console.log("[DEBUG] Found ApiClient directly on BrevoSDK.");
    } else if (BrevoSDK && BrevoSDK.default && BrevoSDK.default.ApiClient) {
        BrevoAPI = BrevoSDK.default; // Exports might be under .default
        console.log("[DEBUG] Found ApiClient under BrevoSDK.default.");
    } else {
        console.warn("[DEBUG] Could not find ApiClient directly or under .default. Will attempt to proceed.");
        BrevoAPI = BrevoSDK; // Fallback to original, might fail later but allows logging
    }
    // ---------------------------------------------

    // Check specific properties based on BrevoAPI
    console.log("[DEBUG] BrevoAPI.ApiClient:", BrevoAPI ? BrevoAPI.ApiClient : 'BrevoAPI is undefined/null');
    console.log("[DEBUG] BrevoAPI keys:", BrevoAPI ? Object.keys(BrevoAPI) : 'BrevoAPI is undefined/null'); // Log available keys

} catch (error) {
    console.error("[DEBUG] Failed to require @getbrevo/brevo:", error);
    BrevoAPI = null; // Ensure BrevoAPI is null if require fails
}
// ------------------------------------------

const admin = require('firebase-admin');

// --- Firebase Admin Initialization ---
let db; // Define db outside the try block
try {
    // Check if Firebase Admin is already initialized
    if (!admin.apps.length) {
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
    db = admin.firestore(); // Assign db after initialization
} catch (error) {
    console.error('Firebase Admin Initialization Error:', error);
    db = null; // Set db to null if initialization fails
}
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
    // Ensure db is initialized before attempting to save
    const firestorePromise = db ? saveToFirestore(name, email, message) : Promise.resolve({ success: false, error: "Firestore DB not initialized" });
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
    // db is now checked in the main handler before calling this
    try {
        const submissionRef = db.collection('contact-submissions').doc();
        await submissionRef.set({
            name: name,
            email: email,
            message: message,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
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
        console.log("[DEBUG] Entering sendBrevoEmail function.");

        // Use BrevoAPI which holds the correct exports (hopefully)
        if (!BrevoAPI) {
             console.error("[DEBUG] BrevoAPI is undefined or null at check (require likely failed).");
             throw new Error("Brevo SDK was not loaded correctly.");
        }
        if (!BrevoAPI.ApiClient) {
             console.error("[DEBUG] BrevoAPI.ApiClient is undefined. BrevoAPI keys:", Object.keys(BrevoAPI));
             throw new Error("Brevo SDK loaded, but ApiClient property is missing.");
        }
        console.log("[DEBUG] BrevoAPI.ApiClient seems available.");

        let defaultClient = BrevoAPI.ApiClient.instance; // Use BrevoAPI here
        if (!defaultClient) {
            console.error("[DEBUG] BrevoAPI.ApiClient.instance is undefined.");
            throw new Error("Brevo ApiClient instance is not available.");
        }
        console.log("[DEBUG] defaultClient instance obtained.");

        let apiKeyAuth = defaultClient.authentications["api-key"];
        if (!apiKeyAuth) {
             console.error("[DEBUG] defaultClient.authentications['api-key'] is undefined.");
             throw new Error("Brevo API key authentication setup failed.");
        }
        console.log("[DEBUG] apiKeyAuth object obtained.");

        if (!process.env.SENDINBLUE_API_KEY) {
            console.error("[DEBUG] SENDINBLUE_API_KEY environment variable is missing.");
            throw new Error("Brevo API Key (SENDINBLUE_API_KEY) is not configured in environment variables.");
        }
        apiKeyAuth.apiKey = process.env.SENDINBLUE_API_KEY;
        console.log("[DEBUG] Brevo API Key assigned from environment variable.");
        // -----------------------------

        // Use BrevoAPI for classes too
        if (!BrevoAPI.TransactionalEmailsApi) {
            console.error("[DEBUG] BrevoAPI.TransactionalEmailsApi is undefined.");
            throw new Error("Brevo TransactionalEmailsApi class is missing.");
        }
        const apiInstance = new BrevoAPI.TransactionalEmailsApi();
        console.log("[DEBUG] TransactionalEmailsApi instance created.");

        if (!BrevoAPI.SendSmtpEmail) {
            console.error("[DEBUG] BrevoAPI.SendSmtpEmail is undefined.");
            throw new Error("Brevo SendSmtpEmail class is missing.");
        }
        const sendSmtpEmail = new BrevoAPI.SendSmtpEmail();
        console.log("[DEBUG] SendSmtpEmail instance created.");


        // Sender details
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
            { email: "harshitkumar9234@gmail.com", name: "Harshit Kumar" },
        ];
        sendSmtpEmail.replyTo = { email: email, name: name };
        console.log("[DEBUG] Email object configured:", JSON.stringify(sendSmtpEmail));

        // Send the email
        console.log("[DEBUG] Calling apiInstance.sendTransacEmail...");
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log("Brevo API called successfully. Result:", data);
        return { success: true, result: data };

    } catch (error) {
        console.error("[DEBUG] Error caught in sendBrevoEmail:", error);
        return { success: false, error: error.message || 'Brevo email failed' };
    }
}

