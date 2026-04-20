# CLAUDE.md

This file provides repo-specific guidance for Claude Code when working in this repository.

## What This App Is

Dependable Admin is a Next.js 16 App Router admin dashboard for the Dependable platform. It is used to manage schools, students, memberships, classrooms, enrollments, school years, billing, and school onboarding. The frontend talks to a separate FastAPI backend.

Primary user-facing workflows:

- Dashboard listing schools and entry points into admin flows
- School detail management through tabbed views
- Student management, enrollment, and profile editing
- School onboarding via CSV-based import workflows
- System-wide user administration for super admins only
- Billing configuration and invoice/report related actions

## Source Of Truth

Prefer the actual code in `src/` over older docs when there is a conflict.

Important: some repository docs still describe an older CSV batch and invite-management product shape. Current route structure and active UI are centered on schools, onboarding, students, memberships, classrooms, school years, billing, and system users.

If you need to understand behavior, inspect these first:

- `src/app/`
- `src/components/`
- `src/lib/`

## Stack

- Next.js 16.1.1
- React 19
- TypeScript 5
- NextAuth v5 beta with Google OAuth
- Tailwind CSS 4
- Axios for backend API calls
- `next-themes` for dark mode
- Sentry for production error tracking

## Commands

```bash
npm install
npm run dev
npm run build
npm run start
npm run lint
```

There is no test suite configured at the moment. Validation should normally be `npm run lint` and, when relevant, a production build.

## Environment

Expected local environment file: `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=<openssl rand -base64 32>
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SUPER_ADMIN_EMAILS=email1@example.com,email2@example.com
NEXT_PUBLIC_SUPER_ADMIN_EMAILS=email1@example.com,email2@example.com
```

Notes:

- `NEXT_PUBLIC_API_URL` points to the FastAPI backend.
- `AUTH_SECRET` is required for NextAuth.
- Super admin access is controlled by email lists from environment variables, not a backend role lookup in this frontend.

## Core Route Structure

- `/` — server entry page that checks auth and renders the dashboard client
- `/auth/signin` — custom Google sign-in page
- `/onboarding` — onboarding list/workflow
- `/onboarding/create` — create a school onboarding flow from form data and files
- `/onboarding/[id]` — review and manage onboarding records
- `/schools/[id]` — school detail page with tabbed management views
- `/schools/[id]/students/[studentId]` — student detail/editing page
- `/system/users` — super-admin-only system user management page
- `/api/auth/[...nextauth]` — Auth.js route handler

## Rendering Model

Use the existing split between server and client components.

- Server components handle auth gating and top-level composition.
- Client components handle nearly all interactive data fetching and CRUD flows.
- The app is not built around React Query or a global client cache. Existing components typically fetch in `useEffect`, store local state, and refresh after mutations.

Examples:

- `src/app/page.tsx` fetches the session server-side and renders `DashboardClient`.
- `src/app/system/users/page.tsx` enforces the super-admin gate server-side and renders `SystemUsersClient`.
- `src/app/schools/[id]/page.tsx` is a client page that manages tab state, fetches school data, and delegates tab UI to child components.

## Auth And Token Flow

Authentication is one of the most important parts of this repo. Do not simplify it casually.

Current flow:

1. User signs in with Google through NextAuth.
2. `src/lib/auth.ts` stores the Google ID token in the JWT.
3. The session exposes that token to the client as `session.googleIdToken`.
4. `src/components/AuthInitializer.tsx` reads the session on the client.
5. `src/lib/tokenService.ts` exchanges the Google ID token for a backend access token through the backend auth endpoint.
6. `src/lib/api.ts` injects the backend bearer token into Axios requests.
7. Auth-related 401 responses clear token state and force sign-out or redirect.

Important implementation details:

- Backend tokens are stored in `localStorage` under `backend_token_data`.
- Backend tokens are client-side only. Do not assume server components can directly reuse the same auth state for backend API calls.
- `AuthInitializer` intentionally blocks rendering while auth bootstrap is incomplete to avoid request races and early 401s.
- Expired or invalid Google tokens cause a forced sign-out. There is no silent Google token refresh implemented in this app.

Backend assumption:

- The frontend expects a Google-token exchange endpoint at `/auth/admin/google?token=...` on the backend.

## Middleware And Access Control

- `src/proxy.ts` exports the auth middleware and protects most routes.
- `/auth` is intentionally excluded from auth enforcement.
- `src/lib/permissions.ts` contains the super-admin email helpers.
- `isSuperAdminEmail()` is the gate for system-level admin features.

When modifying access behavior:

- Keep route protection consistent between middleware, server pages, and UI-level affordances.
- Do not rely on client-side hiding alone for privileged features.

## Main Code Areas

### `src/app/`

App Router pages and route handlers.

- `layout.tsx` sets up fonts, session provider, theme provider, auth bootstrap, and header rendering.
- Pages are usually thin wrappers around auth checks and client components.

### `src/components/`

UI and interaction layer.

Patterns used heavily here:

- Modal-based CRUD flows such as `CreateSchoolYearModal`, `EnrollStudentModal`, and `EditMemberModal`
- Page-level client wrappers such as `DashboardClient` and `SystemUsersClient`
- Resource-specific components under `src/components/school/` for tabbed school management
- Profile image components per entity type

Common component behavior:

- Local `loading`, `error`, and form state
- API call on submit
- Parent refresh via `onSuccess` callback after successful mutation
- Tailwind classes inline in JSX

### `src/lib/`

Business logic and API modules.

Key files:

- `api.ts` — shared Axios client, request/response interceptors, and some legacy batch/invite API helpers
- `auth.ts` — NextAuth configuration
- `tokenService.ts` — backend token exchange and local token lifecycle
- `schools.ts` — main domain API for schools, students, memberships, classrooms, enrollments, reports, school years, and some related operations
- `schoolOnboarding.ts` — onboarding records, validation, submission, and class summary logic
- `billing.ts` — billing settings and invoice-related calls
- `users.ts` — system user management APIs
- `permissions.ts` — super-admin email checks

## UI And State Conventions

Match the existing style rather than introducing a new interaction model.

- Use client components for interactive admin screens.
- Use `useEffect` plus local state for data loading unless there is already a better established pattern in the file.
- Keep loading, empty, and error states explicit in the rendered UI.
- Reuse existing visual language: navy `#1A1A6D`, teal `#20B2AA`, light gray backgrounds, dark-mode support.
- Keep new components consistent with the current Tailwind-heavy style.
- Prefer extending existing modal and tab patterns over inventing new abstractions.

Examples of recurring patterns:

- Tab pages in school management are self-contained components that accept `schoolId`.
- Tables often support client-side search/filtering in component state.
- Row click navigation is common for detail views.
- Parent components usually refetch after modal success instead of attempting complicated optimistic updates.

## Data And Domain Notes

Relevant domain objects in the frontend include:

- Schools
- Students
- Memberships
- Classrooms
- Enrollments
- School years
- Billing configuration and invoices
- School onboarding records and class summaries
- System users

Naming is not perfectly uniform across backend and frontend types. Preserve existing payload shapes unless you are intentionally aligning both sides.

Examples:

- Student status values are lower-case strings like `active`, `left`, `graduated`.
- Some gender values are upper-case in school APIs and lower-case in onboarding flows.
- Backend payloads often use snake_case.

## Known Repo-Specific Pitfalls

These details matter and should influence code changes:

1. The current `CLAUDE.md` should reflect the live app, not the older README-era batch invite workflow.
2. `src/lib/api.ts` still contains legacy import-batch and invite types/endpoints. Do not assume they are the central product path.
3. Authentication depends on client-side token bootstrap. Removing or bypassing `AuthInitializer` can break most data-fetching flows.
4. Server components do not automatically have access to the backend bearer token stored in localStorage.
5. `src/components/school/SchoolYearsTab.tsx` contains a TODO for a missing backend endpoint. Treat that area carefully.
6. Super-admin permissions in this frontend are environment-driven, so do not replace them with guessed backend role semantics unless the backend contract is explicitly changing too.

## Working Style For This Repo

When implementing changes, optimize for minimal, maintainable edits.

- Prefer changing the real source of behavior instead of layering workarounds.
- Keep public component props and API call shapes stable unless the task requires a contract change.
- Avoid broad refactors unless there is a clear payoff and the task actually needs it.
- Preserve existing Tailwind and component style.
- Keep comments sparse and only where logic is non-obvious.
- Run lint after meaningful changes when feasible.

## Guidance For Claude When Answering Or Editing

When helping in this repository, Claude should:

- Ground answers in the current codebase, especially `src/lib/` and route files
- Mention auth and token implications when proposing backend-facing changes
- Prefer existing component and modal patterns over new architecture
- Treat older documentation as potentially stale if it conflicts with `src/`
- Call out backend dependencies explicitly when a frontend feature cannot be completed in isolation
- Check whether a page is server or client before suggesting hooks, redirects, or data fetching changes

## Deployment And Infrastructure

Deployment is documented under `terraform/deployment/` and targets AWS Amplify via Terraform.

Useful facts:

- Terraform variables include repository, AWS region, NextAuth secret, and Google OAuth credentials.
- OAuth redirect URIs must be updated after initial deployment if the final app domain changes.
- Sentry is already wired into the app for production observability.

## Practical Validation Checklist

After editing code in this repo, prefer this order:

1. `npm run lint`
2. `npm run build` for routing, type, and production bundling confidence when the change is significant
3. Manual verification of auth-sensitive flows if the change touches auth, API calls, or route protection
