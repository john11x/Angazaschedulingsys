import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import type { Schema } from '../../data/resource';
import { TimeUtils } from '../shared/time-utils';

let client: ReturnType<typeof generateClient<Schema>> | null = null;

async function getClient() {
  if (client) return client;
  const { env } = await import('$amplify/env/create-school-availability');
  const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);
  client = generateClient<Schema>();
  return client;
}

interface CreateSchoolAvailabilityArgs {
  schoolId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  timezone: string;
  isRecurring: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

interface Result {
  success: boolean;
  message: string;
  availabilityId: string | null;
}

/** Reference date for dayOfWeek when normalizing to UTC (any Monday). */
const REF_DATE = '2026-01-05';

export const handler = async (
  event: { arguments: CreateSchoolAvailabilityArgs; identity?: { sub?: string } },
): Promise<Result> => {
  const args = event.arguments;
  const sub = event.identity?.sub;
  if (!sub) return { success: false, message: 'Not authenticated.', availabilityId: '' };
  if (!args?.schoolId || !args?.dayOfWeek || !args?.startTime || !args?.endTime || !args?.timezone) {
    return { success: false, message: 'schoolId, dayOfWeek, startTime, endTime, timezone required.', availabilityId: '' };
  }

  try {
    const c = await getClient();
    const { data: user, errors: userErr } = await c.models.User.get({ id: sub });
    if (userErr?.length) return { success: false, message: userErr.map((e) => e.message).join(', '), availabilityId: '' };
    if (!user) return { success: false, message: 'User not found.', availabilityId: '' };
    if (user.role !== 'LEAD_TEACHER') return { success: false, message: 'Only lead teachers can create school availability.', availabilityId: '' };
    if (user.schoolId !== args.schoolId) {
      return { success: false, message: 'You can only add availability for your own school.', availabilityId: '' };
    }

    const tz = TimeUtils.validateTimezone(args.timezone);
    const today = TimeUtils.getTodayInTimezone(tz);
    if (args.startDate && args.startDate < today) {
      return { success: false, message: 'Cannot set availability for past dates.', availabilityId: '' };
    }
    if (args.startDate && args.startDate === today && TimeUtils.isPastDateTime(args.startDate, args.startTime, tz)) {
      return { success: false, message: 'Start time cannot be in the past for today.', availabilityId: '' };
    }
    const refDate = args.startDate ?? REF_DATE;
    const { startTime, endTime } = TimeUtils.normalizeToUTC({
      startTime: args.startTime,
      endTime: args.endTime,
      date: refDate,
      timezone: tz,
    });

    const { data: existing } = await c.models.Availability.list({
      filter: {
        ownerID: { eq: args.schoolId },
        ownerType: { eq: 'SCHOOL' },
        dayOfWeek: { eq: args.dayOfWeek },
      },
      limit: 100,
    });

    const newSlot = {
      dayOfWeek: args.dayOfWeek,
      startTime,
      endTime,
      startDate: args.startDate ?? undefined,
      endDate: args.endDate ?? undefined,
    };

    for (const slot of existing ?? []) {
      if (
        TimeUtils.slotsOverlap(newSlot, {
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          startDate: slot.startDate,
          endDate: slot.endDate,
        })
      ) {
        return {
          success: false,
          message: 'This availability overlaps with an existing slot. Please choose different times or days.',
          availabilityId: '',
        };
      }
    }

    const { data: created, errors } = await c.models.Availability.create(
      {
        ownerID: args.schoolId,
        ownerType: 'SCHOOL',
        dayOfWeek: args.dayOfWeek as 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN',
        startTime,
        endTime,
        isRecurring: args.isRecurring,
        timezone: tz,
        startDate: args.startDate ?? undefined,
        endDate: args.endDate ?? undefined,
      },
      { authMode: 'iam' },
    );

    if (errors?.length) return { success: false, message: errors.map((e) => e.message).join(', '), availabilityId: '' };
    return { success: true, message: 'Availability added.', availabilityId: created?.id ?? '' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('createSchoolAvailability error:', err);
    return { success: false, message, availabilityId: '' };
  }
};
