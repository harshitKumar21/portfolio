/**
 * Vercel Serverless Function for Portfolio Contact Form
 * Saves submission to Firebase Firestore and sends email via Brevo.
 * Handles POST requests only. Reads secrets from Environment Variables.
 * Uses CommonJS module syntax (`require`, `module.exports`).
 * FINAL VERSION - Addresses missing ApiClient issue.
 */

const BrevoSDK = require("@getbrevo/brevo");
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
        console.log("[Brevo] Entering sendBrevoEmail function.");

        // Ensure SDK loaded
        if (!BrevoSDK) {
             throw new Error("Brevo SDK require failed earlier.");
        }

        // --- NEW AUTHENTICATION METHOD ---
        // 1. Instantiate the specific API you need
        if (!BrevoSDK.TransactionalEmailsApi) {
             throw new Error("BrevoSDK.TransactionalEmailsApi class is missing.");
        }
        const apiInstance = new BrevoSDK.TransactionalEmailsApi();
        console.log("[Brevo] TransactionalEmailsApi instance created.");

        // 2. Access authentications *from the apiInstance*
        if (!apiInstance.authentications || !apiInstance.authentications['api-key']) {
             throw new Error("Could not access authentications object on apiInstance.");
        }
        let apiKeyAuth = apiInstance.authentications['api-key'];
        console.log("[Brevo] apiKeyAuth object obtained from apiInstance.");

        // 3. Set the API key
        if (!process.env.SENDINBLUE_API_KEY) {
            throw new Error("Brevo API Key (SENDINBLUE_API_KEY) is not configured in environment variables.");
        }
        apiKeyAuth.apiKey = process.env.SENDINBLUE_API_KEY;
        console.log("[Brevo] API Key assigned from environment variable.");
        // --- END OF NEW AUTH METHOD ---

        // Ensure SendSmtpEmail class exists
        if (!BrevoSDK.SendSmtpEmail) {
            throw new Error("Brevo SendSmtpEmail class is missing.");
        }
        const sendSmtpEmail = new BrevoSDK.SendSmtpEmail();
        console.log("[Brevo] SendSmtpEmail instance created.");

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

        // Send the email
        console.log("[Brevo] Calling apiInstance.sendTransacEmail...");
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log("Brevo API called successfully. Result:", data);
        return { success: true, result: data };

    } catch (error) {
        console.error("Error sending email via Brevo:", error);
        return { success: false, error: error.message || 'Brevo email failed' };
    }
}

