import { aiService } from '../aiService.js';
import { sendEmail } from './emailService.js';
import { createLead } from './leadService.js';
import { updateCrm } from './crmService.js';
import { sendSms } from './smsService.js';

const resolveTemplate = (value, context) => {
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const resolved = context[key];
      return resolved === undefined || resolved === null ? match : String(resolved);
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplate(item, context));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, val]) => {
      acc[key] = resolveTemplate(val, context);
      return acc;
    }, {});
  }

  return value;
};

const getContextValue = (keyOrValue, context) => {
  if (typeof keyOrValue === 'string' && context[keyOrValue] !== undefined) {
    return context[keyOrValue];
  }
  return resolveTemplate(keyOrValue, context);
};

const executeAction = async ({ action, context, config, organizationId, userId }) => {
  switch (action.type) {
    case 'ai_classify': {
      const rawText = getContextValue(action.params?.text || '', context);
      const categories = action.params?.categories || ['general'];
      const { label, confidence } = await aiService.classifyText(String(rawText), categories, 'business');
      return { classification: label, ai_confidence: confidence };
    }
    case 'ai_score': {
      const rawData = getContextValue(action.params?.data || {}, context);
      const criteria = action.params?.criteria || '';
      const score = await aiService.scoreData(rawData, criteria);
      return { ai_score: score };
    }
    case 'send_email': {
      const resolvedParams = resolveTemplate(action.params || {}, context);
      const result = await sendEmail({
        from: resolvedParams.from || config?.email_from,
        to: resolvedParams.to,
        subject: resolvedParams.subject || 'Aikya Automation',
        body: resolvedParams.body || ''
      });
      return { email_sent: result.sent, email_message_id: result.messageId || null };
    }
    case 'create_lead': {
      const resolvedParams = resolveTemplate(action.params || {}, context);
      const leadId = createLead({
        organizationId,
        userId,
        lead: {
          name: resolvedParams.name,
          email: resolvedParams.email,
          phone: resolvedParams.phone,
          company: resolvedParams.company,
          budget: resolvedParams.budget,
          score: resolvedParams.score || context.ai_score,
          source: resolvedParams.source,
          notes: resolvedParams.notes,
          status: resolvedParams.status || 'new',
          metadata: resolvedParams.metadata || {}
        }
      });
      return { lead_id: leadId };
    }
    case 'update_crm': {
      const resolvedParams = resolveTemplate(action.params || {}, context);
      const result = await updateCrm({
        system: resolvedParams.system || config?.crm_system,
        payload: resolvedParams
      });
      return { crm_updated: result.updated, crm_system: result.system || null };
    }
    case 'send_sms': {
      const resolvedParams = resolveTemplate(action.params || {}, context);
      const result = await sendSms({
        provider: resolvedParams.provider || config?.sms_provider,
        to: resolvedParams.to,
        message: resolvedParams.message || ''
      });
      return { sms_sent: result.sent };
    }
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
};

export const executeWorkflow = async ({ organizationId, userId, actions = [], config = {}, inputData = {} }) => {
  let context = { ...inputData };

  for (const action of actions) {
    const result = await executeAction({
      action,
      context,
      config,
      organizationId,
      userId
    });
    context = { ...context, ...result };
  }

  return context;
};
