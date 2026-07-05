import { syncImapInbox } from './imapSync.js';

export const syncGmailInbox = async ({ organizationId, userId, credentials, limit = 25 }) =>
  syncImapInbox({
    host: 'imap.gmail.com',
    provider: 'gmail',
    organizationId,
    userId,
    credentials,
    limit
  });
