const parseFlag = (value) => {
  if (!value) {
    return false;
  }
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
};

export const billingEnabled = parseFlag(process.env.BILLING_ENABLED);
export const billingCurrency = process.env.BILLING_CURRENCY || 'USD';
