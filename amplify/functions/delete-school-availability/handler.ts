import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import type { Schema } from '../../data/resource';

let client: ReturnType<typeof generateClient<Schema>> | null = null;

async function getClient() {
  if (client) return client;
  const { env } = await import('$amplify/env/delete-school-availability');
  const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);
  client = generateClient<Schema>();
  return client;
}

interface DeleteSchoolAvailabilityArgs {
  availabilityId: string;
}

interface Result {
  success: boolean;
  message: string;
}

export const handler = async (
  event: { arguments: DeleteSchoolAvailabilityArgs; identity?: { sub?: string } },
): Promise<Result> => {
  const availabilityId = event.arguments?.availabilityId;
  const sub = event.identity?.sub;
  if (!sub) return { success: false, message: 'Not authenticated.' };
  if (!availabilityId) return { success: false, message: 'availabilityId is required.' };

  try {
    const c = await getClient();
    const { data: availability, errors: getErr } = await c.models.Availability.get({ id: availabilityId });
    if (getErr?.length) return { success: false, message: getErr.map((e) => e.message).join(', ') };
    if (!availability) return { success: false, message: 'Availability not found.' };
    if (availability.ownerType !== 'SCHOOL') return { success: false, message: 'Not a school availability.' };

    const { data: user, errors: userErr } = await c.models.User.get({ id: sub });
    if (userErr?.length) return { success: false, message: userErr.map((e) => e.message).join(', ') };
    if (!user) return { success: false, message: 'User not found.' };
    if (user.role !== 'LEAD_TEACHER') return { success: false, message: 'Only lead teachers can delete school availability.' };
    if (user.schoolId !== availability.ownerID) {
      return { success: false, message: 'You can only delete availability for your own school.' };
    }

    const { errors } = await c.models.Availability.delete({ id: availabilityId }, { authMode: 'iam' });
    if (errors?.length) return { success: false, message: errors.map((e) => e.message).join(', ') };
    return { success: true, message: 'Deleted.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('deleteSchoolAvailability error:', err);
    return { success: false, message };
  }
};
