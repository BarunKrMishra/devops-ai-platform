import axios from 'axios';

const AI_PROVIDER = (process.env.AI_PROVIDER || 'auto').toLowerCase();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HUGGINGFACE_MODEL = process.env.HUGGINGFACE_MODEL || 'google/flan-t5-base';

const callOpenAI = async (prompt) => {
  if (!OPENAI_API_KEY) {
    return null;
  }

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful AI assistant for business ops and DevOps automation.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    }
  );

  return response.data?.choices?.[0]?.message?.content?.trim() || null;
};

const callAnthropic = async (prompt) => {
  if (!ANTHROPIC_API_KEY) {
    return null;
  }

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: ANTHROPIC_MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }]
    },
    {
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      timeout: 20000
    }
  );

  const content = response.data?.content;
  if (Array.isArray(content) && content.length > 0) {
    return content.map((block) => block.text).join(' ').trim();
  }
  return null;
};

const callHuggingFace = async (prompt) => {
  if (!HUGGINGFACE_API_KEY) {
    return null;
  }

  const response = await axios.post(
    `https://api-inference.huggingface.co/models/${HUGGINGFACE_MODEL}`,
    { inputs: prompt },
    {
      headers: {
        Authorization: `Bearer ${HUGGINGFACE_API_KEY}`
      },
      timeout: 15000
    }
  );

  const output = Array.isArray(response.data) ? response.data[0]?.generated_text : null;
  return typeof output === 'string' ? output.trim() : null;
};

const resolveProvider = () => {
  if (AI_PROVIDER === 'openai') {
    return OPENAI_API_KEY ? 'openai' : null;
  }
  if (AI_PROVIDER === 'anthropic') {
    return ANTHROPIC_API_KEY ? 'anthropic' : null;
  }
  if (AI_PROVIDER === 'huggingface') {
    return HUGGINGFACE_API_KEY ? 'huggingface' : null;
  }

  if (OPENAI_API_KEY) {
    return 'openai';
  }
  if (ANTHROPIC_API_KEY) {
    return 'anthropic';
  }
  if (HUGGINGFACE_API_KEY) {
    return 'huggingface';
  }

  return null;
};

const completeWithProvider = async (provider, prompt) => {
  switch (provider) {
    case 'openai':
      return callOpenAI(prompt);
    case 'anthropic':
      return callAnthropic(prompt);
    case 'huggingface':
      return callHuggingFace(prompt);
    default:
      return null;
  }
};

const pickCategory = (text, categories) => {
  if (!text) {
    return { label: categories[0] || 'general', confidence: 0.4 };
  }
  const lower = text.toLowerCase();
  const match = categories.find((category) => lower.includes(category.toLowerCase()));
  if (match) {
    return { label: match, confidence: 0.75 };
  }
  return { label: categories[0] || 'general', confidence: 0.4 };
};

export const aiService = {
  isEnabled() {
    return Boolean(resolveProvider());
  },

  async complete(prompt) {
    try {
      const provider = resolveProvider();
      if (!provider) {
        return null;
      }
      return await completeWithProvider(provider, prompt);
    } catch (error) {
      console.error('AI completion failed:', error.message || error);
      return null;
    }
  },

  async classifyText(text, categories, context = 'general') {
    const safeCategories = Array.isArray(categories) && categories.length > 0 ? categories : ['general'];
    const prompt = [
      `Classify this ${context} text into one category.`,
      `Categories: ${safeCategories.join(', ')}`,
      `Text: ${text}`
    ].join('\n');

    const response = await this.complete(prompt);
    return pickCategory(response || '', safeCategories);
  },

  async scoreData(data, criteria = '') {
    const prompt = [
      'Score the following data on a 0-100 scale. Return only the number.',
      `Criteria: ${criteria || 'quality, fit, urgency'}`,
      `Data: ${JSON.stringify(data)}`
    ].join('\n');

    const response = await this.complete(prompt);
    const score = response ? Number.parseInt(response.trim(), 10) : NaN;
    return Number.isNaN(score) ? 0 : Math.max(0, Math.min(100, score));
  }
};
