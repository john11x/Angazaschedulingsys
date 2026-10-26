import { defineFunction } from '@aws-amplify/backend';

/**
 * Email via your SMTP. Set in backend.ts (or env when running sandbox):
 *   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SENDER_EMAIL
 * Use SMTP_SECURE=true for port 465.
 */
export const sendSessionNotification = defineFunction({
  name: 'send-session-notification',
  entry: './handler.ts',
  resourceGroupName: 'data',
  timeoutSeconds: 30,
  environment: {},
});
