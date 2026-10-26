import {
  type ClientSchema,
  a,
  defineData,
} from '@aws-amplify/backend';
import { addUserToCoordinatorGroup } from '../functions/add-user-to-coordinator-group/resource';
import { createUserByCoordinator } from '../functions/create-user-by-coordinator/resource';
import { sendSessionNotification } from '../functions/send-session-notification/resource';
import { cancelSession } from '../functions/cancel-session/resource';
import { findAvailableTrainers } from '../functions/find-available-trainers/resource';
import { createSchoolAvailability } from '../functions/create-school-availability/resource';
import { deleteSchoolAvailability } from '../functions/delete-school-availability/resource';

const SchoolType = a.enum(['MEMBER', 'PARTNER']);
const UserRole = a.enum(['LEAD_TEACHER', 'TRAINER', 'COORDINATOR']);
const DayOfWeek = a.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
const BookingStatus = a.enum([
  'SCHEDULED',
  'COMPLETED',
  'CANCELLED_BY_TRAINER',
  'CANCELLED_BY_SCHOOL',
]);
const AvailabilityOwnerType = a.enum(['TRAINER', 'SCHOOL']);

const AddUserToCoordinatorGroupResult = a.customType({
  success: a.boolean(),
  message: a.string(),
});

const NotificationResult = a.customType({
  success: a.boolean(),
  message: a.string(),
});

const CreateUserResult = a.customType({
  success: a.boolean(),
  message: a.string(),
  userId: a.string(),
});

const CancelSessionResult = a.customType({
  success: a.boolean(),
  message: a.string(),
  bookingId: a.string(),
});

const TrainerSlotResult = a.customType({
  trainerId: a.string(),
  trainerName: a.string(),
  schoolId: a.string(),
  schoolName: a.string(),
  leadTeacherName: a.string(),
  leadTeacherId: a.string(),
  overlapStart: a.string(),
  overlapEnd: a.string(),
  schoolSlotId: a.string(),
  trainerSlotId: a.string(),
});

const FindAvailableTrainersResult = a.customType({
  success: a.boolean(),
  message: a.string(),
  slots: a.ref('TrainerSlotResult').array(),
});

const CreateSchoolAvailabilityResult = a.customType({
  success: a.boolean(),
  message: a.string(),
  availabilityId: a.string(),
});

const DeleteSchoolAvailabilityResult = a.customType({
  success: a.boolean(),
  message: a.string(),
});

const schema = a.schema({
  SchoolType,
  UserRole,
  DayOfWeek,
  BookingStatus,
  AvailabilityOwnerType,
  AddUserToCoordinatorGroupResult,
  NotificationResult,
  CreateUserResult,
  CancelSessionResult,
  TrainerSlotResult,
  FindAvailableTrainersResult,
  CreateSchoolAvailabilityResult,
  DeleteSchoolAvailabilityResult,

  // --- Core Models ---

  School: a
    .model({
      name: a.string().required(),
      type: a.ref('SchoolType').required(),
      country: a.string().required(),
      city: a.string().required(),
      timezone: a.string().required(),
      users: a.hasMany('User', 'schoolId'),
      leadTeacherAssignments: a.hasMany('LeadTeacherAssignment', 'schoolId'),
      memberBookings: a.hasMany('Booking', 'memberSchoolId'),
      partnerBookings: a.hasMany('Booking', 'partnerSchoolId'),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.groups(['Coordinators']).to(['create', 'read', 'update', 'delete']),
    ]),

  User: a
    .model({
      fullName: a.string().required(),
      email: a.string().required(),
      phoneNumber: a.string(),
      role: a.ref('UserRole').required(),
      timezone: a.string().required(),
      schoolId: a.id(),
      school: a.belongsTo('School', 'schoolId'),
      leadTeacherAssignments: a.hasMany('LeadTeacherAssignment', 'userId'),
      bookingsAsLeadTeacher: a.hasMany('Booking', 'leadTeacherId'),
      bookingsAsTrainer: a.hasMany('Booking', 'trainerId'),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.groups(['Coordinators']).to(['create', 'read', 'update', 'delete']),
      allow.owner(),
    ]),

  /**
   * Tracks lead-teacher ↔ school assignments over time.
   * Multiple active assignments per school are supported.
   * Set removedAt + isActive=false on reassignment for audit history.
   */
  LeadTeacherAssignment: a
    .model({
      schoolId: a.id().required(),
      school: a.belongsTo('School', 'schoolId'),
      userId: a.id().required(),
      user: a.belongsTo('User', 'userId'),
      assignedAt: a.string().required(),
      removedAt: a.string(),
      isActive: a.boolean().required(),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.groups(['Coordinators']).to(['create', 'read', 'update', 'delete']),
    ]),

  /**
   * Unified availability for both Trainers (Supply) and Schools (Demand).
   *
   * ownerID  = trainer's Cognito sub  OR  school ID
   * ownerType = TRAINER | SCHOOL
   *
   * All times stored in UTC; the source timezone is kept for UI rendering.
   * Trainer-owned records use owner auth (ownerID = sub).
   * School-owned records are managed by Coordinators (group auth).
   */
  Availability: a
    .model({
      ownerID: a.id().required(),
      ownerType: a.ref('AvailabilityOwnerType').required(),
      dayOfWeek: a.ref('DayOfWeek').required(),
      startTime: a.string().required(),
      endTime: a.string().required(),
      isRecurring: a.boolean().required(),
      timezone: a.string().required(),
      startDate: a.string(),
      endDate: a.string(),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.ownerDefinedIn('ownerID'),
      allow.groups(['Coordinators']).to(['create', 'read', 'update', 'delete']),
    ]),

  /**
   * Live booking ledger. cancelledAt + cancellationReason provide
   * an audit trail — cancelled bookings are never deleted.
   */
  Booking: a
    .model({
      date: a.string().required(),
      startTime: a.string().required(),
      endTime: a.string().required(),
      status: a.ref('BookingStatus').required(),
      memberSchoolId: a.id().required(),
      memberSchool: a.belongsTo('School', 'memberSchoolId'),
      leadTeacherId: a.id().required(),
      leadTeacher: a.belongsTo('User', 'leadTeacherId'),
      trainerId: a.id().required(),
      trainer: a.belongsTo('User', 'trainerId'),
      partnerSchoolId: a.id().required(),
      partnerSchool: a.belongsTo('School', 'partnerSchoolId'),
      cancelledAt: a.string(),
      cancellationReason: a.string(),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.ownerDefinedIn('leadTeacherId').to(['read', 'update']),
      allow.ownerDefinedIn('trainerId').to(['create', 'read', 'update']),
      allow.groups(['Coordinators']).to(['create', 'read', 'update', 'delete']),
    ]),

  // --- Custom Mutations ---

  addUserToCoordinatorGroup: a
    .mutation()
    .returns(a.ref('AddUserToCoordinatorGroupResult'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(addUserToCoordinatorGroup)),

  createUserByCoordinator: a
    .mutation()
    .arguments({
      fullName: a.string().required(),
      email: a.string().required(),
      phoneNumber: a.string(),
      role: a.string().required(),
      schoolId: a.id(),
      timezone: a.string().required(),
    })
    .returns(a.ref('CreateUserResult'))
    .authorization((allow) => [allow.groups(['Coordinators'])])
    .handler(a.handler.function(createUserByCoordinator)),

  cancelSession: a
    .mutation()
    .arguments({
      bookingId: a.string().required(),
      reason: a.string(),
    })
    .returns(a.ref('CancelSessionResult'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(cancelSession)),

  sendSessionNotification: a
    .mutation()
    .arguments({
      action: a.string().required(),
      sessionDate: a.string().required(),
      startTime: a.string().required(),
      endTime: a.string().required(),
      trainerName: a.string().required(),
      trainerEmail: a.string().required(),
      trainerPhone: a.string(),
      trainerTimezone: a.string().required(),
      leadTeacherName: a.string().required(),
      leadTeacherEmail: a.string().required(),
      leadTeacherTimezone: a.string().required(),
      memberSchoolName: a.string().required(),
      partnerSchoolName: a.string().required(),
    })
    .returns(a.ref('NotificationResult'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(sendSessionNotification)),

  findAvailableTrainers: a
    .query()
    .arguments({
      schoolId: a.string(),
      date: a.string().required(),
    })
    .returns(a.ref('FindAvailableTrainersResult'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(findAvailableTrainers)),

  createSchoolAvailability: a
    .mutation()
    .arguments({
      schoolId: a.string().required(),
      dayOfWeek: a.string().required(),
      startTime: a.string().required(),
      endTime: a.string().required(),
      timezone: a.string().required(),
      isRecurring: a.boolean().required(),
      startDate: a.string(),
      endDate: a.string(),
    })
    .returns(a.ref('CreateSchoolAvailabilityResult'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(createSchoolAvailability)),

  deleteSchoolAvailability: a
    .mutation()
    .arguments({
      availabilityId: a.string().required(),
    })
    .returns(a.ref('DeleteSchoolAvailabilityResult'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(deleteSchoolAvailability)),
})
  .authorization((allow) => [
    allow.resource(addUserToCoordinatorGroup).to(['query']),
    allow.resource(createUserByCoordinator).to(['query', 'mutate']),
    allow.resource(cancelSession).to(['query', 'mutate']),
    allow.resource(findAvailableTrainers).to(['query']),
    allow.resource(createSchoolAvailability).to(['query', 'mutate']),
    allow.resource(deleteSchoolAvailability).to(['query', 'mutate']),
  ]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
