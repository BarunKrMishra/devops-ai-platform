import { BusinessLead } from '../../models/index.js';

export const createLead = async ({ organizationId, userId, lead }) => {
  const {
    name,
    email,
    phone,
    company,
    budget,
    score,
    status = 'new',
    source,
    notes,
    metadata = {}
  } = lead;

  const doc = await BusinessLead.create({
    organization_id: organizationId,
    created_by: userId,
    name: name || null,
    email: email || null,
    phone: phone || null,
    company: company || null,
    budget: typeof budget === 'number' ? budget : budget ? Number(budget) : null,
    score: typeof score === 'number' ? score : score ? Number(score) : null,
    status,
    source: source || null,
    notes: notes || null,
    metadata: metadata || {}
  });

  return doc.id;
};
