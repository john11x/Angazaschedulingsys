import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import type { Schema } from '../../data/resource';
import { SchedulingService } from '../shared/scheduling-service';
import { TimeUtils } from '../shared/time-utils';

const lambda = new LambdaClient({});

let client: ReturnType<typeof generateClient<Schema>> | null = null;

async function getClient() {
  if (client) return client;
  const { env } = await import('$amplify/env/cancel-session');
  const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);
  client = generateClient<Schema>();
  return client;
}

interface CancelSessionEvent {
  arguments: { bookingId: string; reason?: string | null };
  identity?: { sub?: string; groups?: string[] };
}

interface CancelSessionResult {
  success: boolean;
  message: string;
  bookingId: string | null;
}

export const handler = async (
  event: CancelSessionEvent,
): Promise<CancelSessionResult> => {
  const { bookingId, reason } = event.arguments;
  const callerSub = event.identity?.sub || (event.identity as any)?.claims?.sub;
  const callerGroups = event.identity?.groups ?? (event.identity as any)?.claims?.['cognito:groups'] ?? [];

  console.log('CancelSession request:', {
    bookingId,
    callerSub,
    callerGroups,
  });

  if (!callerSub) {
    return { success: false, message: 'Not authenticated.', bookingId: null };
  }

  if (!bookingId) {
    return { success: false, message: 'bookingId is required.', bookingId: null };
  }

  try {
    const dataClient = await getClient();
    const { data: booking, errors } = await dataClient.models.Booking.get(
      { id: bookingId },
      { authMode: 'iam' },
    );

    if (errors?.length) {
      return { success: false, message: errors.map((e) => e.message).join(', '), bookingId };
    }
    if (!booking) {
      return { success: false, message: 'Booking not found.', bookingId };
    }

    if (booking.status !== 'SCHEDULED') {
      return {
        success: false,
        message: `Booking is already "${booking.status}" and cannot be cancelled.`,
        bookingId,
      };
    }

    const isCoordinator = callerGroups.includes('Coordinators');
    let status: 'CANCELLED_BY_TRAINER' | 'CANCELLED_BY_SCHOOL';

    if (isCoordinator) {
      status = 'CANCELLED_BY_SCHOOL';
    } else {
      const determined = SchedulingService.determineCancellationStatus(
        { trainerId: booking.trainerId, leadTeacherId: booking.leadTeacherId },
        callerSub,
      );

      if (!determined) {
        console.error('Cancellation authorization failed:', {
          received: { callerSub },
          expected: {
            trainerId: booking.trainerId,
            leadTeacherId: booking.leadTeacherId,
          },
        });
        return {
          success: false,
          message: 'You are not authorized to cancel this booking.',
          bookingId,
        };
      }
      status = determined;
    }

    const { errors: updateErrors } = await dataClient.models.Booking.update(
      {
        id: bookingId,
        status,
        cancelledAt: TimeUtils.nowUTC(),
        cancellationReason: reason ?? undefined,
      },
      { authMode: 'iam' },
    );

    if (updateErrors?.length) {
      return { success: false, message: updateErrors.map((e) => e.message).join(', '), bookingId };
    }

    const fnName = process.env.SEND_SESSION_NOTIFICATION_FUNCTION_NAME;
    if (fnName) {
      const [trainerRes, leadTeacherRes, memberSchoolRes, partnerSchoolRes] = await Promise.all([
        dataClient.models.User.get({ id: booking.trainerId }),
        dataClient.models.User.get({ id: booking.leadTeacherId }),
        dataClient.models.School.get({ id: booking.memberSchoolId }),
        dataClient.models.School.get({ id: booking.partnerSchoolId }),
      ]);
      const trainer = trainerRes.data;
      const leadTeacher = leadTeacherRes.data;
      const memberSchool = memberSchoolRes.data;
      const partnerSchool = partnerSchoolRes.data;
      if (trainer?.email && leadTeacher?.email && memberSchool?.name && partnerSchool?.name) {
        const payload = {
          arguments: {
            action: 'CANCELLED',
            sessionDate: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            trainerName: trainer.fullName ?? 'Trainer',
            trainerEmail: trainer.email,
            trainerPhone: trainer.phoneNumber ?? '',
            trainerTimezone: trainer.timezone,
            leadTeacherName: leadTeacher.fullName ?? 'Lead Teacher',
            leadTeacherEmail: leadTeacher.email,
            leadTeacherTimezone: leadTeacher.timezone,
            memberSchoolName: memberSchool.name,
            partnerSchoolName: partnerSchool.name,
          },
        };
        try {
          await lambda.send(
            new InvokeCommand({
              FunctionName: fnName,
              InvocationType: 'Event',
              Payload: JSON.stringify(payload),
            }),
          );
        } catch (invokeErr) {
          console.error('Failed to send cancellation notification:', invokeErr);
        }
      }
    }

    return {
      success: true,
      message: `Booking cancelled (${status}). The time slot has been released back to the available pool.`,
      bookingId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('cancelSession error:', err);
    return { success: false, message: `Failed to cancel session: ${message}`, bookingId };
  }
};
