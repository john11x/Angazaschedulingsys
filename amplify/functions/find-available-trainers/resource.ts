import { defineFunction } from '@aws-amplify/backend';

export const findAvailableTrainers = defineFunction({
  name: 'find-available-trainers',
  entry: './handler.ts',
  resourceGroupName: 'data',
});
