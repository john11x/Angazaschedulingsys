import {
  CognitoIdentityProviderClient,
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
  const { env } = await import('$amplify/env/add-user-to-coordinator-group');
  const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);
  client = generateClient<Schema>();
  return client;
}

interface AddUserToCoordinatorGroupEvent {
  arguments?: Record<string, unknown>;
  identity?: { sub?: string };
  request?: { headers?: Record<string, string> };
}

interface AddUserToCoordinatorGroupResult {
  success: boolean;
  message: string;
}

function getSubFromEvent(event: AddUserToCoordinatorGroupEvent): string | undefined {
  return (
    event.identity?.sub ??
    (event as unknown as { identity?: { sub?: string }; info?: { fieldName: string }; request?: { headers?: Record<string, string> } }).identity?.sub
  );
}

export const handler = async (
  event: AddUserToCoordinatorGroupEvent,
): Promise<AddUserToCoordinatorGroupResult> => {
  const sub = getSubFromEvent(event);

  if (!sub) {
    return { success: false, message: 'Not authenticated.' };
  }

  const userPoolId = process.env.USER_POOL_ID;
  const groupName = process.env.GROUP_NAME ?? 'Coordinators';

  if (!userPoolId) {
    console.error('Missing USER_POOL_ID');
    return { success: false, message: 'Server configuration error.' };
  }

  try {
    const dataClient = await getClient();
    const { data: user } = await dataClient.models.User.get({ id: sub });

    if (!user || user.role !== 'COORDINATOR') {
      return { success: false, message: 'User is not a Coordinator.' };
    }

    await cognito.send(
      new AdminAddUserToGroupCommand({
        GroupName: groupName,
        Username: sub,
        UserPoolId: userPoolId,
      }),
    );

    return { success: true, message: 'Added to Coordinators group.' };
  } catch (err) {
    if (err instanceof Error && err.name === 'UserNotFoundException') {
      return { success: false, message: 'User not found in Cognito.' };
    }
    if (err instanceof Error && err.name === 'NotAuthorizedException') {
      return { success: false, message: 'Already in group or invalid state.' };
    }
    console.error('addUserToCoordinatorGroup error:', err);
    return { success: false, message: 'Failed to add to group.' };
  }
};
