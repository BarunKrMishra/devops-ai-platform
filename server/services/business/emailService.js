import { createEmailTransport } from '../../utils/email.js';

let transporter = createEmailTransport();

const refreshTransport = () => {
  transporter = createEmailTransport();
  return transporter;
};

export const sendEmail = async ({ from, to, subject, body }) => {
  const activeTransport = transporter || refreshTransport();
  if (!activeTransport) {
    return { sent: false, reason: 'email_not_configured' };
  }

  const message = {
    from: from || process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    text: body
  };

  const info = await activeTransport.sendMail(message);
  return { sent: true, messageId: info?.messageId || null };
};
