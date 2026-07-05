export const sendSms = async ({ provider, to, message }) => {
  if (!provider) {
    return { sent: false, reason: 'sms_provider_not_configured' };
  }

  return {
    sent: true,
    provider,
    to,
    message
  };
};
