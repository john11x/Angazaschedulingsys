import 'dotenv/config';
import * as iam from 'aws-cdk-lib/aws-iam';
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { addUserToCoordinatorGroup } from './functions/add-user-to-coordinator-group/resource';
import { createUserByCoordinator } from './functions/create-user-by-coordinator/resource';
import { sendSessionNotification } from './functions/send-session-notification/resource';
import { cancelSession } from './functions/cancel-session/resource';
import { findAvailableTrainers } from './functions/find-available-trainers/resource';
import { createSchoolAvailability } from './functions/create-school-availability/resource';
import { deleteSchoolAvailability } from './functions/delete-school-availability/resource';

const backend = defineBackend({
  auth,
  data,
  addUserToCoordinatorGroup,
  createUserByCoordinator,
  sendSessionNotification,
  cancelSession,
  findAvailableTrainers,
  createSchoolAvailability,
  deleteSchoolAvailability,
});

const { cfnUserPoolClient } = backend.auth.resources.cfnResources;
cfnUserPoolClient.addPropertyOverride('ExplicitAuthFlows', [
  'ALLOW_USER_SRP_AUTH',
  'ALLOW_REFRESH_TOKEN_AUTH',
  'ALLOW_ADMIN_USER_PASSWORD_AUTH',
]);

// --- addUserToCoordinatorGroup ---
const { addUserToCoordinatorGroup: addUserFn } = backend;

addUserFn.addEnvironment(
  'USER_POOL_ID',
  backend.auth.resources.userPool.userPoolId,
);

addUserFn.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['cognito-idp:AdminAddUserToGroup'],
    resources: [backend.auth.resources.userPool.userPoolArn],
  }),
);

// --- createUserByCoordinator (Trainer / Lead Teacher Onboarding) ---
const { createUserByCoordinator: createUserFn } = backend;

createUserFn.addEnvironment(
  'USER_POOL_ID',
  backend.auth.resources.userPool.userPoolId,
);

createUserFn.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['cognito-idp:AdminCreateUser', 'cognito-idp:AdminAddUserToGroup'],
    resources: [backend.auth.resources.userPool.userPoolArn],
  }),
);

// --- sendSessionNotification (SMTP env vars from .env / Amplify env) ---
const { sendSessionNotification: notifyFn } = backend;

notifyFn.addEnvironment('SMTP_HOST', process.env.SMTP_HOST ?? '');
notifyFn.addEnvironment('SMTP_PORT', process.env.SMTP_PORT ?? '587');
notifyFn.addEnvironment('SMTP_SECURE', process.env.SMTP_SECURE ?? 'false');
notifyFn.addEnvironment('SMTP_USER', process.env.SMTP_USER ?? '');
notifyFn.addEnvironment('SMTP_PASS', process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD ?? '');
notifyFn.addEnvironment('SENDER_EMAIL', process.env.SENDER_EMAIL ?? process.env.SMTP_USER ?? '');

notifyFn.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['sns:Publish'],
    resources: ['*'],
  }),
);

const { cancelSession: cancelSessionFn } = backend;
cancelSessionFn.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['lambda:InvokeFunction'],
    resources: [notifyFn.resources.lambda.functionArn],
  }),
);
cancelSessionFn.addEnvironment('SEND_SESSION_NOTIFICATION_FUNCTION_NAME', notifyFn.resources.lambda.functionName);

const { createSchoolAvailability: createSchoolAvailFn } = backend;
const { deleteSchoolAvailability: deleteSchoolAvailFn } = backend;
const dataApi = backend.data.resources.cfnResources.cfnGraphqlApi;
[cancelSessionFn, createSchoolAvailFn, deleteSchoolAvailFn].forEach((fn) => {
  fn.resources.lambda.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ['appsync:GraphQL'],
      resources: [`${dataApi.attrArn}/*`],
    }),
  );
});
