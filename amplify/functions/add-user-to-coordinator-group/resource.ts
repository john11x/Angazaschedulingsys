import { defineFunction } from '@aws-amplify/backend';

export const addUserToCoordinatorGroup = defineFunction({
  name: 'add-user-to-coordinator-group',
  entry: './handler.ts',
  resourceGroupName: 'data',
  environment: {
    GROUP_NAME: 'Coordinators',
  },
});
