import { defineAuth } from '@aws-amplify/backend';

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 *
 * Uses Cognito default email (no custom SES). MFA is OFF to avoid requiring
 * SES (email MFA) or SMS configuration.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  multifactor: {
    mode: 'OFF',
  },
  groups: ['Coordinators'],
});
