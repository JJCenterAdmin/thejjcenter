// Shared Gmail SMTP sender — used by audit and report scripts
// Requires GMAIL_USER and GMAIL_APP_PASSWORD in environment

import { createTransport } from 'nodemailer';

export function createGmailTransport() {
  return createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function sendEmail({ to, subject, html, text, attachments = [] }) {
  const transporter = createGmailTransport();
  await transporter.sendMail({
    from: `The JJ Center <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    text,
    attachments,
  });
}
