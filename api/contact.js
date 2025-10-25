/*
 * This file uses CommonJS syntax (require/module.exports) to match your package.json
 * It now saves to Firebase AND sends an email.
 */

// Import libraries
const Brevo = require("@getbrevo/brevo");
const admin = require("firebase-admin"); // Added Firebase Admin

// --- NEW: Initialize Firebase Admin ---
try {
  // Check if Firebase is already initialized
  if (admin.apps.length === 0) {
    // Get the service account JSON from the environment variable
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
    });
  }
} catch (e) {
  console.error("Failed to initialize Firebase Admin:", e.message);
}

// Get Firestore instance (do this *after* try/catch)
let db;
try {
  db = admin.firestore();
} catch (e) {
  console.error("Failed to get Firestore instance:", e.message);
  // db will be undefined, and the save task will fail gracefully
}
// ------------------------------------

// Use module.exports to export the handler function
module.exports = async (req, res) => {
  // 1. Check for POST request
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // 2. Get form data from the request body
  const { name, email, message } = req.body;

  // Basic validation
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // --- Task 1: Define the function to send the email ---
  const sendEmailTask = () => {
    const SENDER_EMAIL = "harshitkumar9234@gmail.com";
    const SENDER_NAME = "Harshit Kumar (Portfolio)";
    
    const defaultClient = Brevo.ApiClient.instance;
    const apiKeyAuth = defaultClient.authentications["api-key"];
    apiKeyAuth.apiKey = process.env.SENDINBLUE_API_KEY;

    const apiInstance = new Brevo.TransactionalEmailsApi();
    const sendSmtpEmail = new Brevo.SendSmtpEmail();

    // Create the email
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

    return apiInstance.sendTransacEmail(sendSmtpEmail);
  };

  // --- Task 2: Define the function to save to Firebase ---
  const saveToFirebaseTask = () => {
    if (!db) {
      // Throw an error if Firebase wasn't initialized correctly
      throw new Error("Firestore database is not initialized on the server.");
    }
    const submissionData = {
      name,
      email,
      message,
      timestamp: new Date(),
      // Get user agent and IP from request headers
      userAgent: req.headers['user-agent'] || 'unknown',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    };
    // Save to the 'contact-submissions' collection
    return db.collection('contact-submissions').add(submissionData);
  };


  // 5. Send email AND save to Firebase
  try {
    // Run both tasks at the same time
    const [emailResult, firebaseResult] = await Promise.all([
      sendEmailTask(),
      saveToFirebaseTask()
    ]);

    console.log("Brevo API called successfully. Result: ", emailResult);
    console.log("Firebase save successful. Result ID: ", firebaseResult.id);

    return res.status(200).json({ success: true, message: 'Message sent and saved.' });

  } catch (error) {
    // This block will run if *either* the email or the save fails
    console.error("Error in contact form handler:", error.message);
    
    let userErrorMessage = 'An error occurred.';
    if (error.response) { // This is likely a Brevo error
       console.error("Brevo Error Body:", error.response.body);
       userErrorMessage = "Failed to send email.";
    } else if (error.message.includes("Firestore")) {
       userErrorMessage = "Failed to save message to database.";
    }

    return res.status(500).json({ success: false, error: userErrorMessage, details: error.message });
  }
};

