# Account ID Authentication Design

## Goal

Replace Google/magic-link-first sign-in with a mobile-first account flow based on email, login ID, and password. Registration also captures coach name and school name. Password recovery sends a secure reset link to the registered email; the existing password is never recoverable or emailed.

## User flows

### Sign up

The user enters email, login ID, password, password confirmation, coach name, and school name. Login IDs are normalized to lowercase and must be unique. Passwords remain exclusively in Supabase Auth. The Worker creates the Supabase Auth user and a private `account_profiles` row, then returns a session that the browser installs into Supabase.

### Sign in

The user enters login ID and password. The Worker resolves the ID to the private account profile, authenticates against Supabase using the stored email, and returns the resulting access/refresh tokens. The browser installs those tokens using `supabase.auth.setSession`.

### Password recovery

The login screen exposes `パスワードを忘れた方`. The recovery form requires an email address and calls Supabase password recovery. Supabase emails a reset link. The link returns to the app with `?reset-password=1`; after Supabase establishes the recovery session the app shows a new-password form and calls `supabase.auth.updateUser({ password })`. The app then removes the recovery query flag and resumes normal bootstrap.

### Initial school setup

Account registration owns coach name and school name. If the authenticated user has no game yet, bootstrap fetches the account profile and passes it into the existing school setup UI. That screen displays the registered coach/school values and only asks for values still required to create the game (school short name and prefecture). `displayName` is the login ID.

## Security

- No plaintext password is stored outside Supabase Auth.
- Existing passwords are never emailed. Recovery is reset-link based.
- `account_profiles` is RLS-enabled with no anon/authenticated read policy; normal browser clients cannot query it directly.
- Login ID to email resolution occurs only in the Worker with the Supabase secret key.
- Login failures return a generic message so account existence is not disclosed.
- Registration conflicts return a single generic conflict message for duplicate email or ID.
- Login IDs are 4-24 characters after normalization and allow lowercase ASCII letters, numbers, `.`, `_`, and `-`.
- Password minimum length is 8 characters.

## Data model

`public.account_profiles`

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `login_id text not null unique`
- `email text not null`
- `coach_name text not null`
- `school_name text not null`
- timestamps

The table has RLS enabled and is accessed by the Worker service role only.

## Worker API

Unauthenticated:

- `POST /api/auth/register`
- `POST /api/auth/login`

Authenticated:

- `GET /api/account/profile`

The existing `/api/*` bearer-token requirement remains unchanged for all other routes.

## Client interfaces

`AuthClient` gains:

- `signInWithCredentials(loginId, password)`
- `registerAccount(input)`
- `requestPasswordReset(email)`
- `updatePassword(password)`
- `isPasswordRecovery()`

Google OAuth and email OTP methods are removed from the active auth client.

`GameApiClient` gains `getAccountProfile(accessToken)` for first-run defaults.

## UI

The login card uses a single-column mobile layout with large inputs and 48px+ tap targets. Login is the default tab. New-account registration is a separate mode in the same card. Password recovery is a third mode. Google UI and magic-link copy are removed. Password reset after email-link return uses the same visual system.

## Testing

- Worker unit tests: registration validation, duplicate conflict, ID login, generic invalid-login response, profile retrieval, auth bypass routing.
- Auth client unit tests: worker credential login installs session, registration installs session, recovery mail, password update.
- Login UI tests: no Google, ID/password login, registration fields, confirmation mismatch, recovery email flow.
- App bootstrap/onboarding tests: recovery screen takes precedence; account profile prefills coach/school and onboarding submits registered values.
- Mobile E2E: login/signup screens fit the viewport with no horizontal overflow.
