import { defineFunction } from '@aws-amplify/backend';

export const createUserByCoordinator = defineFunction({
  name: 'create-user-by-coordinator',
  entry: './handler.ts',
  resourceGroupName: 'data',
});
