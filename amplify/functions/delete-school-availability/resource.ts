import { defineFunction } from '@aws-amplify/backend';

export const deleteSchoolAvailability = defineFunction({
  name: 'delete-school-availability',
  entry: './handler.ts',
  resourceGroupName: 'data',
});
