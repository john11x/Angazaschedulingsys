export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export type BookingStatus =
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'CANCELLED_BY_TRAINER'
  | 'CANCELLED_BY_SCHOOL';

export type AvailabilityOwnerType = 'TRAINER' | 'SCHOOL';

export type UserRole = 'COORDINATOR' | 'LEAD_TEACHER' | 'TRAINER';

export type SchoolType = 'MEMBER' | 'PARTNER';

export interface AvailabilitySlot {
  id: string;
  ownerID: string;
  ownerType: AvailabilityOwnerType;
  dayOfWeek: DayOfWeek;
  startTime: string; // UTC "HH:mm"
  endTime: string; // UTC "HH:mm"
  isRecurring: boolean;
  timezone: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface BookingRecord {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  memberSchoolId: string;
  leadTeacherId: string;
  trainerId: string;
  partnerSchoolId: string;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
}

export interface IntersectionResult {
  trainerId: string;
  trainerName?: string;
  overlapStart: string; // UTC "HH:mm"
  overlapEnd: string; // UTC "HH:mm"
  schoolSlotId: string;
  schoolId: string;
  trainerSlotId: string;
}

export interface CancelSessionInput {
  bookingId: string;
  reason?: string;
}

export interface CancelSessionResult {
  success: boolean;
  message: string;
  bookingId: string | null;
}
