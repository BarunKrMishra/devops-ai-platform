import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { BusinessEmail } from '../../models/index.js';
import { aiService } from '../aiService.js';

const normalizePassword = (raw) => String(raw || '').replace(/\s+/g, '');

export const syncImapInbox = async ({
  host,
  port = 993,
  secure = true,
  provider = 'imap',
  organizationId,
  userId,
  credentials,
  limit = 25
}) => {
  if (!credentials) {
    return { synced: 0, reason: 'missing_credentials' };
  }

  const email = credentials.email || credentials.user;
  const appPassword = normalizePassword(
    credentials.app_password || credentials.password || credentials.appPassword
  );

  if (!email || !appPassword) {
    return { synced: 0, reason: 'missing_email_or_password' };
  }

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user: email, pass: appPassword }
  });

  let synced = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const unseen = await client.search({ seen: false });
      const targetUids = unseen.length
        ? unseen.slice(-limit)
        : [];

      if (targetUids.length === 0) {
        return { synced: 0, reason: 'no_unseen_messages' };
      }

      for await (const message of client.fetch(targetUids, {
        uid: true,
        envelope: true,
        source: true,
        internalDate: true
      })) {
        const parsed = await simpleParser(message.source);
        const subject = parsed.subject || message.envelope?.subject || null;
        const from = parsed.from?.text || message.envelope?.from?.[0]?.address || null;
        const to = parsed.to?.text || message.envelope?.to?.[0]?.address || null;
        const body = parsed.text || parsed.html || null;

        let classification = null;
        let score = null;
        const text = `${subject || ''}\n${body || ''}`.trim();
        if (text) {
          try {
            const { label } = await aiService.classifyText(text, ['support', 'sales', 'billing', 'general'], 'email');
            classification = label;
            score = await aiService.scoreData({ subject, body }, 'urgency and intent');
          } catch (error) {
            console.error('Email classification failed:', error);
          }
        }

        await BusinessEmail.create({
          organization_id: organizationId,
          created_by: userId,
          from_address: from,
          to_address: to,
          subject,
          body,
          classification,
          ai_score: score,
          processed_at: message.internalDate || new Date(),
          metadata: {
            message_id: parsed.messageId || null,
            imap_uid: message.uid || null,
            provider
          }
        });

        synced += 1;
        if (message.uid) {
          await client.messageFlagsAdd(message.uid, ['\\Seen']);
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return { synced };
};
