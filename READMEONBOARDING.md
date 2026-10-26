# Welcome to the Angaza P2P Scheduler!

Hey! We are super excited to have you hacking on this with us.

This document is your cheat sheet. It explains how this thing actually works, where the code lives, and how we work together without stepping on each other's toes.

We are all learning here. The goal isn't to write "perfect" code; the goal is to write code that works, is easy to read, and helps the kids in our member schools. If you see something that can be improved, speak up! We love creative ideas.

---

## The Big Picture: How it Works

We are building a **Decentralized Booking System**:

- **The Tech:** We use **AWS Amplify Gen 2**. This means our Backend (Database, Auth, Functions) and Frontend (React) live in the same repo. It’s serverless, so we don't manage servers.
- **The Logic:**
  - **Trainers (Supply):** They post availability for *any* time they are free.
  - **Schools (Demand):** They have set Operating Hours (e.g., 8 AM - 5 PM). They don't post availability; they just block out dates when they are closed (like exams, holidays, or whatever that makes them unavailable ).
  - **The Magic:** When a School Supervisor searches for a trainer, our backend filters out anyone who doesn't overlap with that school's specific open hours.

---

## Where Does Stuff Go?

Don't guess! Here is the map:

 **`amplify/data/resource.ts` *→* *The Database.** This is where we define our tables (Schema). If you need to add a field to `User`, go here.

 **`amplify/auth/resource.ts` *→* *The Users.** Cognito settings live here.

 **`amplify/functions/` *→* *The Brains.** Complicated logic (like "Find me a trainer" or "Cancel this session") lives here as Lambda functions.

 **`src/` *→* *The Frontend.** Standard React + TypeScript code.

```
* `src/App.tsx` → The main entry point.

* `src/components/` → Reusable UI buttons, cards, etc.
```

---

## How We Work (The Golden Rules)

To keep us moving fast and avoid "Merge Conflict Hell," please follow these rules:

### 1. The "WhatsApp First" Rule

**Before you write a single line of code**, go to our WhatsApp group and type:

> *"Hey team, I'm picking up the 'Cancel Button' task now."*

Why? Because someone else might already be working on it! This saves us from doing double work.

### 2. Never Push to Main 

- **Bad:** Coding on `main` and pushing. (Please don't do this!)
- **Good:** Create a branch: `git checkout -b feature/login-page`.
- **Best:** When you are done, create a **Pull Request (PR)** on GitHub. We will review it together, merge it, and high-five.

---

## Coding Style: Keep it Boring

We value **clarity** over cleverness.

- **Be Boring:** Write code that is so simple a tired person can understand it. If you are writing a complex "one-liner", delete it and write 3 clear lines instead.
- **DRY (Don't Repeat Yourself):** If you copy-paste code more than once, stop. Turn it into a function or a component.
- **Clean Up:** Leave the code better than you found it. If you see a messy function, feel free to tidy it up.

---

##  How to Start

1. **Clone the repo.**
2. **Install:** Run `pnpm install` (we use pnpm, it's faster).
3. **Run:** Run `npx ampx sandbox`. This creates a "Sandbox" AWS environment just for you. It might take a few minutes the first time.
4. **Code:** Start building!

Remember: **Ask questions.** There are no dumb questions, only unasked ones that turn into bugs later.

Let’s build something awesome.