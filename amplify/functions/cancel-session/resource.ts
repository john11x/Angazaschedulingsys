import { defineFunction } from '@aws-amplify/backend';

export const cancelSession = defineFunction({
  name: 'cancel-session',
  entry: './handler.ts',
  resourceGroupName: 'data',
});
