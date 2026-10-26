import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import type { Schema } from '../../data/resource';

const cognito = new CognitoIdentityProviderClient();

let client: ReturnType<typeof generateClient<Schema>> | null = null;

async function getClient() {
  if (client) return client;
  const { env } = await import('$amplify/env/create-user-by-coordinator');
  const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);
  client = generateClient<Schema>();
  return client;
}

const VALID_ROLES = ['LEAD_TEACHER', 'TRAINER', 'COORDINATOR'] as const;
type CreatableRole = (typeof VALID_ROLES)[number];

interface CreateUserInput {
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  role: string;
  schoolId?: string | null;
  timezone: string;
}

interface CreateUserEvent {
  arguments: CreateUserInput;
}

interface CreateUserResult {
  success: boolean;
  message: string;
  userId: string | null;
}

const ROLE_LABELS: Record<CreatableRole, string> = {
  LEAD_TEACHER: 'Lead Teacher',
  TRAINER: 'Trainer',
  COORDINATOR: 'Coordinator',
};

export const handler = async (event: CreateUserEvent): Promise<CreateUserResult> => {
  const input = event.arguments;

  if (!input?.fullName || !input?.email || !input?.role || !input?.timezone) {
    return { success: false, message: 'Missing required fields.', userId: null };
  }

  if (!VALID_ROLES.includes(input.role as CreatableRole)) {
    return { success: false, message: `Invalid role "${input.role}". Must be LEAD_TEACHER, TRAINER, or COORDINATOR.`, userId: null };
  }

  const role = input.role as CreatableRole;
  const isCoordinator = role === 'COORDINATOR';

  const userPoolId = process.env.USER_POOL_ID;
  if (!userPoolId) {
    console.error('Missing USER_POOL_ID');
    return { success: false, message: 'Server configuration error.', userId: null };
  }

  try {
    const dataClient = await getClient();

    let schoolObj: any = null;
    if (!isCoordinator && input.schoolId) {
      const expectedSchoolType = role === 'LEAD_TEACHER' ? 'MEMBER' : 'PARTNER';
      const { data: school } = await dataClient.models.School.get({ id: input.schoolId });
      if (!school) {
        return { success: false, message: `School "${input.schoolId}" not found.`, userId: null };
      }
      if (school.type !== expectedSchoolType) {
        return {
          success: false,
          message: `${ROLE_LABELS[role]}s must be assigned to a ${expectedSchoolType} school. "${school.name}" is ${school.type}.`,
          userId: null,
        };
      }
      schoolObj = school;
    }

    const cognitoResult = await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: input.email,
        UserAttributes: [
          { Name: 'email', Value: input.email },
          { Name: 'email_verified', Value: 'true' },
        ],
        DesiredDeliveryMediums: ['EMAIL'],
      }),
    );

    const cognitoSub = cognitoResult.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
    if (!cognitoSub) {
      return { success: false, message: 'Cognito user created but sub not returned.', userId: null };
    }

    if (isCoordinator) {
      await cognito.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: userPoolId,
          Username: cognitoSub,
          GroupName: 'Coordinators',
        }),
      );
    }

    const { errors } = await dataClient.models.User.create({
      id: cognitoSub,
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      role,
      timezone: (role === 'LEAD_TEACHER' && schoolObj) ? schoolObj.timezone : input.timezone,
      schoolId: isCoordinator ? undefined : input.schoolId ?? undefined,
      phoneNumber: input.phoneNumber?.trim() || undefined,
    });

    if (errors?.length) {
      console.error('User DB create errors:', errors);
      return { success: false, message: errors.map((e) => e.message).join(', '), userId: cognitoSub };
    }

    if (role === 'LEAD_TEACHER' && input.schoolId) {
      const { errors: assignErr } = await dataClient.models.LeadTeacherAssignment.create({
        schoolId: input.schoolId,
        userId: cognitoSub,
        assignedAt: new Date().toISOString(),
        isActive: true,
      });
      if (assignErr?.length) {
        console.warn('LeadTeacherAssignment create warning:', assignErr);
      }
    }

    const assignmentSuffix =
      !isCoordinator && !input.schoolId
        ? ' You can assign them to a school later if needed.'
        : '';

    return {
      success: true,
      message: `${input.fullName.trim()} was invited as a ${ROLE_LABELS[role]}. We sent sign-in instructions to ${input.email.trim().toLowerCase()}.${assignmentSuffix}`,
      userId: cognitoSub,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof Error && err.name === 'UsernameExistsException') {
      return { success: false, message: `An account already exists for ${input.email.trim().toLowerCase()}.`, userId: null };
    }
    console.error('createUserByCoordinator error:', err);
    return { success: false, message: `Failed to create user: ${message}`, userId: null };
  }
};
