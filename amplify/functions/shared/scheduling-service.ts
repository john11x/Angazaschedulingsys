import type {
  AvailabilitySlot,
  BookingRecord,
  IntersectionResult,
} from './types';
import { TimeUtils } from './time-utils';

/**
 * Core scheduling business logic.
 *
 * All stateless computation lives here — Lambda handlers delegate to these
 * methods instead of embedding logic directly.
 */
export class SchedulingService {
  /**
   * Availability Intersection Engine (Architecture §4.A).
   *
   * Finds time overlaps between a Member School's requested slots and all
   * Trainer availability slots, then filters out trainers who already have
   * a SCHEDULED booking during the overlap window.
   *
   * Match condition:
   *   Trainer.Start < School.End  AND  Trainer.End > School.Start
   */
  static findIntersections(
    schoolSlots: AvailabilitySlot[],
    trainerSlots: AvailabilitySlot[],
    existingBookings: BookingRecord[],
  ): IntersectionResult[] {
    const scheduledByTrainer = new Map<string, BookingRecord[]>();
    for (const b of existingBookings) {
      if (b.status !== 'SCHEDULED') continue;
      const list = scheduledByTrainer.get(b.trainerId) ?? [];
      list.push(b);
      scheduledByTrainer.set(b.trainerId, list);
    }

    const results: IntersectionResult[] = [];

    for (const school of schoolSlots) {
      const sStart = TimeUtils.timeToMinutes(school.startTime);
      const sEnd = TimeUtils.timeToMinutes(school.endTime);

      for (const trainer of trainerSlots) {
        if (trainer.dayOfWeek !== school.dayOfWeek) continue;

        const tStart = TimeUtils.timeToMinutes(trainer.startTime);
        const tEnd = TimeUtils.timeToMinutes(trainer.endTime);

        if (tStart >= sEnd || tEnd <= sStart) continue; // no overlap

        const overlapStart = Math.max(sStart, tStart);
        const overlapEnd = Math.min(sEnd, tEnd);

        const trainerBookings = scheduledByTrainer.get(trainer.ownerID) ?? [];
        const hasConflict = trainerBookings.some((b) => {
          const bStart = TimeUtils.timeToMinutes(b.startTime);
          const bEnd = TimeUtils.timeToMinutes(b.endTime);
          return bStart < overlapEnd && bEnd > overlapStart;
        });

        if (!hasConflict) {
          results.push({
            trainerId: trainer.ownerID,
            overlapStart: TimeUtils.minutesToTime(overlapStart),
            overlapEnd: TimeUtils.minutesToTime(overlapEnd),
            schoolSlotId: school.id,
            schoolId: school.ownerID,
            trainerSlotId: trainer.id,
          });
        }
      }
    }

    return results;
  }

  /**
   * Determine the correct cancellation status based on the caller's relationship
   * to the booking. Returns null when the caller is neither party (Coordinator
   * case is handled separately by the handler).
   */
  static determineCancellationStatus(
    booking: Pick<BookingRecord, 'trainerId' | 'leadTeacherId'>,
    callerUserId: string,
  ): 'CANCELLED_BY_TRAINER' | 'CANCELLED_BY_SCHOOL' | null {
    if (booking.trainerId === callerUserId) return 'CANCELLED_BY_TRAINER';
    if (booking.leadTeacherId === callerUserId) return 'CANCELLED_BY_SCHOOL';
    return null;
  }
}
