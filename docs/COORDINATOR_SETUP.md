# First coordinator (one-time bootstrap)

The **Create user** UI can only be called by accounts in the Cognito group **`Coordinators`**. To create the **first** coordinator:

1. **AWS Console** → **Cognito** → your User pool → **Users** → **Create user**  
   - Username = email  
   - Temporary password  
2. **Groups** → **Coordinators** → **Add user** (same user).
3. **App database**: create a **User** row with the same `id` as the user’s Cognito **sub** (UUID), `role` = `COORDINATOR`, plus `fullName`, `email`, `timezone` (e.g. `Africa/Nairobi`).  
   - Easiest: **AppSync** console → run a `createUser` mutation, or insert in DynamoDB for the `User` table.

After that, sign in at **Staff login** → you land on **Coordinator portal** (`/app`). Use **Create user** to add more coordinators, lead teachers, and trainers (no manual Cognito steps).
