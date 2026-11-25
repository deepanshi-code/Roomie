import nodemailer from 'nodemailer';
import { MAIL_FROM, SMTP_URL } from './config.js';

const transport = SMTP_URL ? nodemailer.createTransport(SMTP_URL) : null;

/** True when emails are only printed to the console (local development). */
export const isConsoleMailer = !transport;

export async function sendMail({ to, subject, text }) {
  if (!transport) {
    console.log(`\n[mail → console] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  await transport.sendMail({ from: MAIL_FROM, to, subject, text });
}
