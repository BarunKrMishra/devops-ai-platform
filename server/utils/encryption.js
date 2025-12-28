import crypto from 'crypto';

const getKeyBuffer = () => {
  const rawKey = process.env.INTEGRATION_MASTER_KEY;
  if (!rawKey) {
    throw new Error('INTEGRATION_MASTER_KEY is not set');
  }

  let keyBuffer;
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    keyBuffer = Buffer.from(rawKey, 'hex');
  } else {
    try {
      keyBuffer = Buffer.from(rawKey, 'base64');
    } catch (error) {
      keyBuffer = Buffer.from(rawKey, 'utf8');
    }
  }

  if (keyBuffer.length !== 32) {
    keyBuffer = crypto.createHash('sha256').update(rawKey).digest();
  }

  return keyBuffer;
};

export const encryptPayload = (payload) => {
  const key = getKeyBuffer();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: ciphertext.toString('base64')
  };
};

export const decryptPayload = (envelope) => {
  if (!envelope) {
    return null;
  }

  const key = getKeyBuffer();
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const data = Buffer.from(envelope.data, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
};
