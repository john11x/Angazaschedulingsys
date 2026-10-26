```markdown
# P2P Scheduling System - System Architecture

## 1. Project Overview
We are building a **Peer-to-Peer (P2P) Scheduling Marketplace** for an educational network. The system connects **Member Schools** (Demand) with **Trainers** from Partner Schools (Supply).

**Core Value Proposition:**
* **Smart Matching:** The system calculates the intersection between a Member School's schedule and Trainer availability to suggest lead_teacher/program coordinator perfect matches.
* **Booking:** A seamless, real-time booking engine.
* **Resilience:** A robust cancellation workflow. If a trainer cancels, the system releases the slot and alerts the school to re-book immediately the same as when the school cancels, let the trainer know.

---

## 2. Terminology & Actors

| Actor | Source Data Sheet | Role |
| :--- | :--- | :--- |
| **Member School** | `Member Schools Data` | **The Buyer.** A school that needs training. Represented by a "Lead Teacher". Lead teacher can be created during the school creation as well. Also, the lead teacher can be updated to a new one. 
| **Partner School** | `Partner Schools Data` | **The Supplier.** A school that provides Trainers. |
| **Lead Teacher** | `Lead Member School Teacher Data` | **The User (Buyer).** The person at a Member School who logs in to book trainers. |
| **Trainer** | `P2P Trainers Data` | **The User (Seller).** A Student from a Partner School who offers time slots, individual with no partner school can also be a trainer
| **Coordinator** | `Program Coordinators Data` | **The Admin.** Oversees the program (optional observer). |

---

## 3. Data Architecture (Schema)

The database (AWS Amplify Data / DynamoDB) consolidates the source spreadsheets into **4 Core Models**.

### Model 1: `School`
*Consolidates "Member Schools Data" and "Partner Schools Data".*
* **id**: ID (Primary Key)
* **name**: String
* **type**: Enum (`MEMBER` | `PARTNER`) — *Crucial for UI filtering.*
* **country**: String
* **city**: String
* **timezone**: String (e.g., "Africa/Kigali")

### Model 2: `User`
*Consolidates "Lead Member School Teacher", "Program Coordinators", and "P2P Trainers".*
* **id**: ID (Primary Key - Linked to Cognito Auth)
* **fullName**: String
* **email**: String
* **phoneNumber**: String
* **role**: Enum (`LEAD_TEACHER` | `TRAINER` | `COORDINATOR`)
* **schoolId**: ID (Foreign Key linking to `School`. Nullable for Coordinators or trainer who is not from any schools).

### Model 3: `Availability` (Supply & Demand Rules)
*Consolidates "Trainer Availability" AND "Member School Availability".*
We split this into two models in the code for clarity, or handle it via relationships.
* **TrainerAvailability**:
    * **trainerId**: ID (FK to User)
    * **dayOfWeek**: Enum (`MON`...`SUN`)
    * **startTime**: Time
    * **endTime**: Time
* **SchoolAvailability**:
    * **schoolId**: ID (FK to School - *Member Schools use this*)
    * **dayOfWeek**: Enum (`MON`...`SUN`)
    * **startTime**: Time
    * **endTime**: Time

### Model 4: `Booking` (The Transaction)
*Source: "Historical Data" sheet.* This is the **Live Ledger** of the system.
* **id**: ID
* **date**: Date (ISO 8601 Date string, e.g., "2026-02-10")
* **startTime**: Time
* **endTime**: Time
* **status**: Enum (`SCHEDULED` | `COMPLETED` | `CANCELLED_BY_TRAINER` | `CANCELLED_BY_SCHOOL`)
* **memberSchoolId**: ID (The Buyer)
* **leadTeacherId**: ID (The person who clicked "Book")
* **trainerId**: ID (The person booked)
* **partnerSchoolId**: ID (The trainer's organization)

---

## 4. Business Logic & Workflows

### A. The "Matching Engine" (Primary Discovery Flow)
Instead of searching blindly, Member Schools input their own "Desired Time" (SchoolAvailability). The system finds the overlaps.

**The Algorithm (Intersection Logic):**
1.  **Input:** Current User (Lead Teacher) selects a Date (e.g., "Tue 2026-02-10").
2.  **Fetch Demand:** Get `SchoolAvailability` for the User's School (e.g., "Tue 10:00-11:00").
3.  **Fetch Supply:** Get `TrainerAvailability` for ALL Trainers on "Tue".
4.  **Calculate Intersection:**
    * Match if: `(Trainer.Start <= School.End) AND (Trainer.End >= School.Start)`
5.  **Filter Conflicts:** Exclude Trainers who have a `Booking` (status=`SCHEDULED`) during that overlap.
6.  **Output:** A list of "Perfect Matches" (Trainers available exactly when the school needs them).

### B. The Booking Flow
1.  **User Action:** Lead Teacher sees a match and clicks "Book".
2.  **Validation:** Backend checks **atomically** if the slot is still free.
3.  **Action:** Create a new record in `Booking` table with status `SCHEDULED`.
4.  **Result:** The slot instantly disappears from search results for other users.

### C. The Cancellation Loop (Critical Requirement)
**Scenario:** A Trainer cancels a session.
1.  **Trigger:** Trainer clicks "Cancel Booking" for Feb 10th.
2.  **State Change:** Update `Booking` record status to `CANCELLED_BY_TRAINER`.
3.  **Resource Release:** Because status is no longer `SCHEDULED`, the Availability Engine automatically sees this slot as "Free" again.
4.  **Notification:**
    * System detects the cancellation.
    * Frontend/Notification Service alerts the **Lead Teacher** (Member School).
    * **Member School State:** Transitions from "Fulfilled" to "Idle" (Needs Attention).

---

## 5. Technical Stack
* **Frontend:** React (TypeScript), Tailwind CSS.
* **Backend:** AWS Amplify Gen 2 (Data Client).
* **Database:** Amazon DynamoDB (NoSQL).
* **Auth:** Amazon Cognito (User Pools).
* **API:** AWS AppSync (GraphQL) - Managed by Amplify.

## 6. Security Rules (Authorization)
* **Public Read:** Anyone (authenticated) can view Schools and Trainers.
* **Owner Write:**
    * Only a **Trainer** can create/edit their own `TrainerAvailability`.
    * Only a **Lead Teacher** (Admin of School) can create/edit `SchoolAvailability`.
    * Only a **Lead Teacher** can create a `Booking` (Member Schools initiate demand).
    * Only the **Parties Involved** (Trainer or Lead Teacher) can edit/cancel a `Booking`.


```

