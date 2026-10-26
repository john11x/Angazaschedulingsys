import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import type { Schema } from '../../data/resource';
import { SchedulingService } from '../shared/scheduling-service';
import { dateToDayOfWeek } from '../shared/date-utils';
import type { AvailabilitySlot, BookingRecord } from '../shared/types';

let client: ReturnType<typeof generateClient<Schema>> | null = null;

async function getClient() {
  if (client) return client;
  const { env } = await import('$amplify/env/find-available-trainers');
  const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);
  client = generateClient<Schema>();
  return client;
}

interface FindAvailableTrainersArgs {
  schoolId?: string;
  date: string; // YYYY-MM-DD
}

interface TrainerSlotResult {
  trainerId: string;
  trainerName: string;
  schoolId: string;
  schoolName: string;
  leadTeacherName: string;
  leadTeacherId: string;
  overlapStart: string;
  overlapEnd: string;
  schoolSlotId: string;
  trainerSlotId: string;
}

interface FindAvailableTrainersResult {
  success: boolean;
  message: string;
  slots: TrainerSlotResult[];
}

function toSlot(a: {
  id: string;
  ownerID: string;
  ownerType: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  timezone: string;
}): AvailabilitySlot {
  return {
    id: a.id,
    ownerID: a.ownerID,
    ownerType: a.ownerType as 'TRAINER' | 'SCHOOL',
    dayOfWeek: a.dayOfWeek as AvailabilitySlot['dayOfWeek'],
    startTime: a.startTime,
    endTime: a.endTime,
    isRecurring: a.isRecurring,
    timezone: a.timezone,
  };
}

function toBooking(b: {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  trainerId: string;
  leadTeacherId: string;
  memberSchoolId: string;
  partnerSchoolId: string;
}): BookingRecord {
  return {
    id: b.id,
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status as BookingRecord['status'],
    trainerId: b.trainerId,
    leadTeacherId: b.leadTeacherId,
    memberSchoolId: b.memberSchoolId,
    partnerSchoolId: b.partnerSchoolId,
  };
}

export const handler = async (
  event: { arguments: FindAvailableTrainersArgs },
): Promise<FindAvailableTrainersResult> => {
  const { schoolId, date } = event.arguments;
  if (!date) {
    return { success: false, message: 'date is required.', slots: [] };
  }

  const dayOfWeek = dateToDayOfWeek(date);

  try {
    const c = await getClient();

    const [schoolAvail, trainerAvail, bookingsRes, usersRes, schoolsRes, assignmentsRes] = await Promise.all([
      c.models.Availability.list({
        filter: { 
          ...(schoolId ? { ownerID: { eq: schoolId } } : {}), 
          ownerType: { eq: 'SCHOOL' }, 
          dayOfWeek: { eq: dayOfWeek } 
        },
        limit: 500,
      }),
      c.models.Availability.list({
        filter: { ownerType: { eq: 'TRAINER' }, dayOfWeek: { eq: dayOfWeek } },
        limit: 500,
      }),
      c.models.Booking.list({
        filter: { date: { eq: date }, status: { eq: 'SCHEDULED' } },
        limit: 200,
      }),
      c.models.User.list({
        limit: 1000,
      }),
      c.models.School.list({
        limit: 1000,
      }),
      c.models.LeadTeacherAssignment.list({
        filter: { isActive: { eq: true } },
        limit: 200,
      }),
    ]);

    const userMap = new Map<string, { fullName: string; role: string }>();
    (usersRes.data ?? []).forEach((u) => {
      userMap.set(u.id, { fullName: u.fullName, role: u.role });
    });

    const schoolMap = new Map<string, { name: string; leadTeacherName: string; leadTeacherId: string }>();
    const schoolToLT = new Map<string, { name: string; id: string }>();
    (assignmentsRes.data ?? []).forEach((a) => {
      if (a.isActive) {
        schoolToLT.set(a.schoolId, { 
          name: userMap.get(a.userId)?.fullName ?? 'Unknown LT', 
          id: a.userId 
        });
      }
    });

    (schoolsRes.data ?? []).forEach((s) => {
      const lt = schoolToLT.get(s.id);
      schoolMap.set(s.id, { 
        name: s.name, 
        leadTeacherName: lt?.name ?? 'No LT Assigned',
        leadTeacherId: lt?.id ?? ''
      });
    });

    const schoolSlots = (schoolAvail.data ?? []).map(toSlot);
    
    const trainerSlots = (trainerAvail.data ?? [])
      .map(toSlot)
      .filter((s) => {
        const user = userMap.get(s.ownerID);
        return user?.role === 'TRAINER';
      });

    const bookings = (bookingsRes.data ?? []).map(toBooking);

    const intersections = SchedulingService.findIntersections(schoolSlots, trainerSlots, bookings);

    const slots: TrainerSlotResult[] = intersections.map((r) => {
      const schoolInfo = schoolMap.get(r.schoolId);
      return {
        trainerId: r.trainerId,
        trainerName: userMap.get(r.trainerId)?.fullName ?? 'Trainer',
        schoolId: r.schoolId,
        schoolName: schoolInfo?.name ?? `School (${r.schoolId || 'Missing ID'})`,
        leadTeacherName: schoolInfo?.leadTeacherName ?? 'Unknown',
        leadTeacherId: schoolInfo?.leadTeacherId ?? '',
        overlapStart: r.overlapStart,
        overlapEnd: r.overlapEnd,
        schoolSlotId: r.schoolSlotId,
        trainerSlotId: r.trainerSlotId,
      };
    });

    return { success: true, message: `OK (Found ${slots.length} slots)`, slots };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('findAvailableTrainers error:', err);
    return { success: false, message, slots: [] };
  }
};
