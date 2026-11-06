# Authentication and Role-Based Access Control

## Login/session design

Passwords are stored as Argon2id hashes. Login creates a high-entropy opaque session token; only its SHA-256 digest is stored in MySQL `auth_sessions`. The cookie is HttpOnly, SameSite=Lax, scoped to `/`, and Secure in production. Sessions expire after eight hours and logout revokes the server-side row. A separate CSRF token is stored as a digest with the session, sent in a readable `f1_csrf` cookie, returned by `/api/auth/me`, and required in `X-CSRF-Token` for logout and future state-changing cookie-authenticated routes.

Create the first account explicitly after schema initialization:

```powershell
cd backend
python -m app.cli create-user --email admin@example.test --display-name "Project Admin" --role ADMIN
```

The command prompts for the password and never stores plaintext. The example address is a placeholder; do not reuse it as a real identity.

## Roles and permissions

| Permission | ADMIN | ANALYST |
|---|---:|---:|
| `race:read` | Yes | Yes |
| `strategy:write` | Yes | Yes |
| `data:import` | Yes | No |
| `users:manage` | Yes | No |
| `audit:read` | Yes | No |

Assignments are stored in `roles`, `permissions`, `user_roles`, and `role_permissions`. The backend checks permissions from the current server-side session. `/api/admin/users` and `/api/admin/audit` are protected independently of frontend navigation. The admin API writes audit records for account creation and role changes. Public read-only analytics endpoints are not a substitute for a protected write operation.

## Verification procedure

1. Create one ADMIN and one ANALYST through the CLI/admin UI.
2. Log in through `/api/auth/login`; inspect the HttpOnly session cookie and CSRF response.
3. Use the analyst session to request `GET /api/admin/users`; expect `403 Permission denied`.
4. Use the admin session for the same request; expect `200` and user records.
5. Call logout with the CSRF cookie value in `X-CSRF-Token`; then request `/api/auth/me` and expect `401`.

`database/mysql/05_database_privileges.sql` reduces the Compose runtime account to SELECT, INSERT, UPDATE, DELETE, and EXECUTE on the project database. Schema changes must use an administrative connection; the runtime API cannot create/alter/drop tables or manage accounts. MongoDB's local Compose service is loopback-only and currently unauthenticated for development; production must enable authentication and scoped roles.

Local verification completed through the same-origin Next.js proxy with test ADMIN and ANALYST accounts: both logged in, ADMIN access to `/api/admin/users` returned 200, ANALYST access returned 403, logout returned 204, and `/api/auth/me` returned 401 after logout. The demo accounts are for local use only. MongoDB's local Compose service remains unauthenticated for development; production must enable authentication, TLS, strong secrets, restricted database accounts, and managed secret storage.
