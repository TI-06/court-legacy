# Account ID Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure ID/password account registration and login, mobile-first auth screens, and email-based password reset while carrying coach/school registration data into onboarding.

**Architecture:** Keep Supabase Auth as the password/session authority. Add a private account profile table and Worker auth endpoints so login ID resolution never exposes account email. Extend the active Supabase auth client to install Worker-returned sessions and handle recovery/reset. Bootstrap fetches the private profile only after authentication and uses it as onboarding defaults.

**Tech Stack:** React, TypeScript, Supabase Auth/PostgREST, Cloudflare Worker, Zod, Vitest/Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-04-account-id-auth-design.md`

## Global Constraints
- No plaintext passwords outside Supabase Auth.
- Existing passwords are never emailed; password recovery uses Supabase reset links.
- `account_profiles` is service-role-only through RLS.
- Login ID is normalized lowercase, 4-24 chars, `[a-z0-9._-]`.
- Password minimum length is 8.
- Auth UI is single-column and mobile-first with 48px+ tap targets.
- Google OAuth and magic-link login are removed from the active UI.

---

### Task 1: Account profile persistence and Worker auth service

**Files:**
- Create: `supabase/migrations/202609040007_account_profiles.sql`
- Create: `worker/auth/AccountAuthService.ts`
- Create: `worker/routes/accountRegister.ts`
- Create: `worker/routes/accountLogin.ts`
- Create: `worker/routes/accountProfile.ts`
- Modify: `worker/router.ts`
- Modify: `worker/index.ts`
- Test: `tests/unit/worker/accountAuthRoutes.test.ts`

**Interfaces:**
- Produces `AccountProfile`, `AccountAuthSession`, and `AccountAuthService`.
- Routes: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/account/profile`.

- [ ] **Step 1: Write failing route/service tests** covering valid registration, duplicate conflict, ID login, invalid credentials, and authenticated profile read.
- [ ] **Step 2: Run focused tests** and confirm failures are due to missing service/routes.
- [ ] **Step 3: Add migration and minimal Worker service/routes** using Supabase Admin for user/profile creation and the Auth token endpoint for password verification.
- [ ] **Step 4: Re-run focused tests** and make them green.
- [ ] **Step 5: Commit** with `feat: add account id auth worker endpoints`.

### Task 2: Active browser AuthClient contract

**Files:**
- Modify: `src/services/auth/AuthClient.ts`
- Modify: `src/services/auth/SupabaseAuthClient.ts`
- Modify: `src/services/auth/MockAuthClient.ts`
- Test: `tests/unit/services/auth/SupabaseAuthClient.test.ts`

**Interfaces:**
- `signInWithCredentials(loginId: string, password: string): Promise<void>`
- `registerAccount(input: AccountRegistrationInput): Promise<void>`
- `requestPasswordReset(email: string): Promise<void>`
- `updatePassword(password: string): Promise<void>`
- `isPasswordRecovery(): boolean`

- [ ] **Step 1: Write failing AuthClient tests** for Worker login/register session installation, password recovery, and password update.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement methods using same-origin Worker fetch plus Supabase `setSession`, `resetPasswordForEmail`, and `updateUser`**.
- [ ] **Step 4: Verify focused and existing auth tests GREEN**.
- [ ] **Step 5: Commit** with `feat: support id password browser auth`.

### Task 3: Mobile login, registration, and recovery UI

**Files:**
- Modify: `src/features/auth/LoginScreen.tsx`
- Modify: `src/features/auth/auth.css`
- Create: `src/features/auth/PasswordResetScreen.tsx`
- Test: `tests/unit/features/auth/LoginScreen.test.tsx`
- Test: `tests/unit/features/auth/PasswordResetScreen.test.tsx`

**Interfaces:**
- Login mode calls `signInWithCredentials`.
- Registration mode calls `registerAccount` after local password confirmation validation.
- Recovery mode calls `requestPasswordReset` with normalized email.
- Password reset screen calls `updatePassword`.

- [ ] **Step 1: Replace existing Google/magic-link expectations with failing ID/password/register/recovery tests**.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement three-mode mobile auth card and recovery screen**.
- [ ] **Step 4: Verify UI tests GREEN**.
- [ ] **Step 5: Commit** with `feat: add mobile account auth screens`.

### Task 4: Carry account profile into first school setup

**Files:**
- Modify: `src/services/api/GameApiClient.ts`
- Modify: `src/app/AppBootstrap.tsx`
- Modify: `src/features/onboarding/SchoolSetupScreen.tsx`
- Modify: `src/features/onboarding/onboarding.css`
- Test: `tests/unit/app/AppBootstrap.test.tsx`
- Test: `tests/unit/features/onboarding/SchoolSetupScreen.test.tsx`

**Interfaces:**
- `GameApiClient.getAccountProfile(accessToken): Promise<AccountProfile>`.
- `SchoolSetupScreen` receives an account profile and submits `displayName=loginId`, `schoolName`, and `coachName` from that profile while asking only for school short name and region.

- [ ] **Step 1: Add failing bootstrap/onboarding tests**.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement profile API call, bootstrap loading, and simplified first-run form**.
- [ ] **Step 4: Verify tests GREEN**.
- [ ] **Step 5: Commit** with `feat: reuse account profile during onboarding`.

### Task 5: Recovery bootstrap and mobile regression

**Files:**
- Modify: `src/app/AppBootstrap.tsx`
- Test: `tests/unit/app/AppBootstrap.test.tsx`
- Modify/Add: `tests/e2e/auth-mobile.spec.ts`

**Interfaces:**
- `AuthClient.isPasswordRecovery()` determines whether `PasswordResetScreen` takes precedence over cloud bootstrap.

- [ ] **Step 1: Add failing recovery-precedence and mobile-overflow tests**.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement recovery precedence and completion transition**.
- [ ] **Step 4: Run `npm run verify` and `npm run test:e2e`**.
- [ ] **Step 5: Commit** with `test: cover account auth recovery and mobile layout`.

### Task 6: PR, CI, and merge

- [ ] **Step 1: Open PR against `main`** with security and migration notes.
- [ ] **Step 2: Run full CI; fix only observed failures**.
- [ ] **Step 3: Confirm quality and mobile-e2e are GREEN**.
- [ ] **Step 4: Squash merge with expected head SHA**.
- [ ] **Step 5: Confirm `main` points to the merge SHA and report deployment prerequisites for the migration/Worker environment.**
