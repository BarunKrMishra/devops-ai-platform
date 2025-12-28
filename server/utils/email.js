import nodemailer from 'nodemailer';

const createResendTransport = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }

  const fallbackFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  return {
    verify: (callback) => {
      if (typeof callback === 'function') {
        callback(null, true);
      }
    },
    sendMail: async (options) => {
      const payload = {
        from: options.from || fallbackFrom,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
      };

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend API error: ${response.status} ${body}`);
      }

      const data = await response.json();
      return { messageId: data.id || 'resend' };
    }
  };
};

export const createEmailTransport = () => {
  const resendTransport = createResendTransport();
  if (resendTransport) {
    return resendTransport;
  }

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : '';

  if (!emailUser || !emailPass) {
    return null;
  }

  const emailHost = process.env.EMAIL_HOST;
  const emailPort = Number(process.env.EMAIL_PORT || 0);
  const emailSecure = process.env.EMAIL_SECURE === 'true';
  const emailService = process.env.EMAIL_SERVICE || 'gmail';

  const baseOptions = {
    auth: { user: emailUser, pass: emailPass },
    connectionTimeout: 10000
  };

  if (emailHost) {
    return nodemailer.createTransport({
      host: emailHost,
      port: emailPort || (emailSecure ? 465 : 587),
      secure: emailSecure,
      ...baseOptions
    });
  }

  return nodemailer.createTransport({
    service: emailService,
    ...baseOptions
  });
};
