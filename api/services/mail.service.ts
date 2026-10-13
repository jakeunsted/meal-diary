import { Resend } from 'resend';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const DEFAULT_FROM = 'Meal Diary <noreply@mealdiary.co.uk>';

/**
 * Send a transactional email through Resend.
 * When RESEND_API_KEY is unset, the message is logged and nothing is sent.
 */
export const sendMail = async (message: MailMessage): Promise<void> => {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.info('[mail] RESEND_API_KEY unset, skipping send', {
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return;
  }

  const resend = new Resend(apiKey);
  const from = process.env.MAIL_FROM?.trim() || DEFAULT_FROM;
  const { error } = await resend.emails.send({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  if (error) {
    throw new Error(error.message || 'Failed to send email');
  }
};
