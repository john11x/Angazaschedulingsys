import { defineFunction } from '@aws-amplify/backend';

export const createSchoolAvailability = defineFunction({
  name: 'create-school-availability',
  entry: './handler.ts',
  resourceGroupName: 'data',
});
