/* eslint-disable max-len */
const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Import the Brevo library
const Brevo = require("@getbrevo/brevo");

// Initialize the Firebase Admin SDK
admin.initializeApp();

// --- Configure Brevo ---
// This is your secret key, loaded from environment variables
const apiKey = process.env.SENDINBLUE_API_KEY;

// This is the email you verified in your Brevo account
const SENDER_EMAIL = "harshitkumar9234@gmail.com";
const SENDER_NAME = "Harshit Kumar (Portfolio)";
// -----------------------

// Initialize the Brevo API client
const defaultClient = Brevo.ApiClient.instance;

// --- FIX WAS HERE ---
// 1. Get the authentication object from the client.
//    I renamed this variable from 'apiKey' to 'apiKeyAuth' to avoid the redeclare error.
const apiKeyAuth = defaultClient.authentications["api-key"];

// 2. Set the authentication object's 'apiKey' property.
//    Use the 'apiKey' variable from line 13 (which holds your secret).
apiKeyAuth.apiKey = apiKey;
// --- END FIX ---

const apiInstance = new Brevo.TransactionalEmailsApi();

/**
 * This is the Cloud Function.
 * It triggers whenever a new document is CREATED in the
 * 'contact-submissions' collection.
 */
exports.sendEmailOnNewSubmission = functions.firestore
  .document("contact-submissions/{submissionId}")
  .onCreate(async (snapshot, context) => {
    // 1. Get the data from the new form submission
    const data = snapshot.data();
    const name = data.name;
    const fromEmail = data.email;
    const message = data.message;

    // 2. Create the email object
    const sendSmtpEmail = new Brevo.SendSmtpEmail();

    sendSmtpEmail.subject = `New Portfolio Message from ${name}`;
    sendSmtpEmail.htmlContent = `
        <p>You received a new message from your portfolio contact form:</p>
        <hr>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${fromEmail}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `;

    // Set the sender (must be a verified sender in Brevo)
    sendSmtpEmail.sender = { email: SENDER_EMAIL, name: SENDER_NAME };

    // Set the recipient (you)
    sendSmtpEmail.to = [
      { email: "harshitkumar9234@gmail.com", name: "Harshit Kumar" },
    ];

    // Set the "reply-to" to be the person who filled out the form
    sendSmtpEmail.replyTo = { email: fromEmail, name: name };

    // 3. Send the email
    try {
      const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log("Brevo API called successfully. Result: ", result);
    } catch (error) {
      console.error("Error sending email via Brevo:", error);
    }
  });
