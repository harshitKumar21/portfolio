/*
 * This file fixes the '405 (Method Not Allowed)' error.
 * It should be placed in your 'api' folder (e.g., /api/contact.js).
 * It is a Vercel serverless function that:
 * 1. Only allows POST requests.
 * 2. Gets the form data (name, email, message) from the request.
 * 3. Sends an email using the Brevo API.
 * 4. Uses the SENDINBLUE_API_KEY from your Vercel Environment Variables.
 */

// Import the Brevo library
const Brevo = require("@getbrevo/brevo");

export default async function handler(req, res) {
  // 1. Check for POST request
  // This is the fix for the 405 error.
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

  // 3. Configure Brevo
  const SENDER_EMAIL = "harshitkumar9234@gmail.com";
  const SENDER_NAME = "Harshit Kumar (Portfolio)";
  
  const defaultClient = Brevo.ApiClient.instance;
  const apiKey = defaultClient.authentications["api-key"];
  // Get the API key from environment variables (NEVER hard-code it)
  apiKey.apiKey = process.env.SENDINBLUE_API_KEY;

  const apiInstance = new Brevo.TransactionalEmailsApi();
  const sendSmtpEmail = new Brevo.SendSmtpEmail();

  // 4. Create the email
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

  // 5. Send the email
  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("Brevo API called successfully. Result: ", data);
    return res.status(200).json({ success: true, message: 'Email sent' });
  } catch (error) {
    console.error("Error sending email via Brevo:", error);
    return res.status(500).json({ success: false, error: 'Failed to send email' });
  }
}
