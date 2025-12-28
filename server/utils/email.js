import nodemailer from 'nodemailer';

export const createEmailTransport = () => {
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
