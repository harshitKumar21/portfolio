/**
 * Vercel Serverless Function for Portfolio Contact Form
 * Saves submission to Firebase Firestore and sends email via Brevo.
 * Handles POST requests only. Reads secrets from Environment Variables.
 * Uses CommonJS module syntax (`require`, `module.exports`).
 * FINAL v3 - Uses the official `sib-api-v3-sdk` package.
 */

// Use the official Brevo SDK package name from their documentation
const SibApiV3Sdk = require('sib-api-v3-sdk');
const admin = require('firebase-admin');

// --- Firebase Admin Initialization ---
let db;
try {
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
    db = admin.firestore();
} catch (error) {
    console.error('Firebase Admin Initialization Error:', error);
    db = null;
}
// ------------------------------------


// --- Brevo Authentication Setup (using sib-api-v3-sdk pattern) ---
let brevoApiClient = null; // Store the initialized client
try {
    if (!SibApiV3Sdk) {
        throw new Error("sib-api-v3-sdk require failed.");
    }
    if (!SibApiV3Sdk.ApiClient || !SibApiV3Sdk.ApiClient.instance) {
        throw new Error("SibApiV3Sdk.ApiClient.instance not found.");
    }

    brevoApiClient = SibApiV3Sdk.ApiClient.instance;
    console.log("[Brevo Auth] Using SibApiV3Sdk.ApiClient.instance");

    // Get the API key configuration from the client
    let apiKeyAuth = brevoApiClient.authentications['api-key'];
    if (!apiKeyAuth) {
        throw new Error("Could not access authentications['api-key'] object.");
    }

    // Set the API key from environment variable
    if (!process.env.SENDINBLUE_API_KEY) {
        throw new Error("Brevo API Key (SENDINBLUE_API_KEY) is not configured.");
    }
    apiKeyAuth.apiKey = process.env.SENDINBLUE_API_KEY;
    console.log("[Brevo Auth] API Key SET using SibApiV3Sdk.ApiClient.instance.");

} catch (error) {
    console.error("Error during Brevo Authentication Setup:", error);
    brevoApiClient = null; // Ensure it's null if setup fails
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
    const firestorePromise = db ? saveToFirestore(name, email, message) : Promise.resolve({ success: false, error: "Firestore DB not initialized" });
    // Pass the initialized client to the email function
    const brevoPromise = sendBrevoEmail(brevoApiClient, name, email, message);

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
    // db check happens before calling
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
// Takes the initialized apiClient as an argument
async function sendBrevoEmail(apiClient, name, email, message) {
    try {
        console.log("[Brevo] Entering sendBrevoEmail function.");

        // Check if authentication setup succeeded earlier
        if (!apiClient) {
            throw new Error("Brevo ApiClient was not initialized correctly (check auth setup).");
        }

        // Ensure necessary classes are available on the main SDK object
        if (!SibApiV3Sdk.TransactionalEmailsApi) { throw new Error("SibApiV3Sdk.TransactionalEmailsApi class is missing."); }
        if (!SibApiV3Sdk.SendSmtpEmail) { throw new Error("SibApiV3Sdk.SendSmtpEmail class is missing."); }

        // Create instances using the main SDK object
        const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
        console.log("[Brevo] API and Email instances created.");

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
        console.log("[Brevo] Email object configured.");

        // Send the email using the API instance
        console.log("[Brevo] Calling apiInstance.sendTransacEmail...");
        // The authentication set globally on apiClient.instance should be used automatically
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log("Brevo API called successfully. Result:", data);
        return { success: true, result: data };

    } catch (error) {
        console.error("Error sending email via Brevo:", error);
        // Provide more details if available in the error object from Brevo
        let errorMessage = error.message || 'Brevo email failed';
        if (error.response && error.response.text) {
             try {
                 const errorBody = JSON.parse(error.response.text);
                 errorMessage += ` Brevo Error: ${errorBody.message || error.response.text}`;
             } catch (e) {
                 errorMessage += ` Brevo Raw Error: ${error.response.text}`;
             }
        } else if (error.code) {
             errorMessage += ` (Code: ${error.code})`;
        }
        return { success: false, error: errorMessage };
    }
}

