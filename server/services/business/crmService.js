export const updateCrm = async ({ system, payload }) => {
  if (!system) {
    return { updated: false, reason: 'crm_not_configured' };
  }

  return {
    updated: true,
    system,
    payload
  };
};
