// Import the Brevo library for sending emails
const Brevo = require('@getbrevo/brevo');

// Import the Firebase Admin library to securely write to your database
const admin = require('firebase-admin');

// --- IMPORTANT: LOAD YOUR SECRETS ---
// These are loaded from Vercel's Environment Variables (we will set this up later)
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;
const SENDER_EMAIL = 'harshitkumar9234@gmail.com';
const SENDER_NAME = 'Portfolio Notifier';

// --- Initialize Firebase Admin ---
// We only initialize the app once
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)),
    });
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error.message);
  }
}
const db = admin.firestore();

// --- Initialize Brevo Client ---
const defaultClient = Brevo.ApiClient.instance;
let apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = BREVO_API_KEY;
const apiInstance = new Brevo.TransactionalEmailsApi();


// --- This is the main function that Vercel will run ---
export default async function handler(request, response) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  const { name, email, message, ip, userAgent } = request.body;

  // --- 1. Save the submission to Firestore ---
  try {
    await db.collection('contact-submissions').add({
      name: name,
      email: email,
      message: message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      // We can get these from Vercel's request object
      ip: request.headers['x-forwarded-for'] || request.socket.remoteAddress,
      userAgent: request.headers['user-agent'],
    });
    console.log('Successfully wrote to Firestore');
  } catch (error) {
    console.error('Error writing to Firestore:', error);
    // We'll still try to send the email, but we'll log the error
  }

  // --- 2. Send the email notification via Brevo ---
  try {
    let sendSmtpEmail = new Brevo.SendSmtpEmail();

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
      { email: 'harshitkumar9234@gmail.com', name: 'Harshit Kumar' },
    ];
    sendSmtpEmail.replyTo = { email: email, name: name };

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Successfully sent email via Brevo');
  } catch (error) {
    console.error('Error sending email via Brevo:', error);
    // Send a "server error" response if email fails
    return response.status(500).json({ success: false, message: 'Error sending email' });
  }

  // --- 3. Send a "Success" response back to the browser ---
  return response.status(200).json({ success: true, message: 'Message sent!' });
}
