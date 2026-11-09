# DevCity Business Suite

Quotations, invoices, receipts and vendor bills, with shared team workspaces and an employee directory.

```
Quotation ──convert──▶ Invoice ──record payment──▶ Receipt
                                         Vendor bills ──▶ Mark as paid
```

- **Workspaces:** anyone can sign up and create a workspace for their company. Colleagues join with an
  **email invitation link** or an **invite code**; code requests wait for an admin to approve them.
- **Roles:** Administrator, Editor and Viewer, enforced by the database.
- **People directory:** job title, department, phone, start date and status (active, on leave, left).
  Setting someone to *left* removes their access immediately.
- **Live collaboration:** changes made by colleagues appear instantly.

## Set up Supabase (one time, about 5 minutes)

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor:** paste the contents of [`supabase/migrations/0001_workspaces.sql`](supabase/migrations/0001_workspaces.sql) and click **Run**.
3. **Authentication → URL Configuration:**
   - Site URL: `http://localhost:5173` (later, your production URL)
   - Redirect URLs: add `http://localhost:5173/**` and `https://your-domain/**`
4. **Project Settings → API:** copy the Project URL and the **anon public** key into `.env.local`:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   The anon key is safe in the browser because every table is protected by Row Level Security.
   **Never** put the `service_role` key in this app.
5. `npm install && npm run dev`, then open http://localhost:5173.

### Sign in with Google (optional)

1. In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), open your
   OAuth client (type *Web application*) and add this **Authorised redirect URI**:
   `https://your-project-ref.supabase.co/auth/v1/callback`
2. In Supabase, go to **Authentication → Sign In / Providers → Google**, enable it, and paste the
   Client ID and Client Secret. The secret lives only in Supabase, never in this app.

### Passkeys (optional)

In Supabase, under **Authentication → Sign In / Providers → Passkeys**, enable passkeys. Set the
**Relying Party ID** to `localhost` for development (your domain in production, e.g. `app.devcity.us`)
and add the matching origin (`http://localhost:5173` / `https://app.devcity.us`). Members add passkeys in
**Settings → Account & security**, then use **Sign in with a passkey**. Passkeys are tied to the
Relying Party ID, so one created on `localhost` won't work on the production domain.

### Emails (sign-up confirmation, password reset)

Supabase's built-in email service only sends a few messages per hour, which is fine for testing.
For production, add your own SMTP server under **Authentication → Emails → SMTP Settings**
(for example Resend, Postmark, SendGrid or Google Workspace).

Invitations are links: after inviting someone, the admin copies the link or clicks **Open email** to send it.

## Production (Vercel): https://business-document.vercel.app

1. **Vercel → Project → Settings → Environment Variables**: add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (same values as `.env.local`), then redeploy. Vite bakes them in at build time.
2. **Supabase → Authentication → URL Configuration**: Site URL `https://business-document.vercel.app`;
   Redirect URLs `https://business-document.vercel.app/**` and `http://localhost:5173/**`.
3. **Passkeys:** Relying Party ID `business-document.vercel.app`, origin `https://business-document.vercel.app`.
4. Security headers and the SPA fallback are configured in `vercel.json`.

## Commands

```bash
npm run dev        # http://localhost:5173
npm run build      # type-check + production build (dist/)
npm run preview    # serve dist/ with the production security headers
npm run lint
```

## Everyday workflow

| Task | Where |
| --- | --- |
| Create a document | **New document** (sidebar), the dashboard, or <kbd>Ctrl</kbd>+<kbd>K</kbd> |
| Find anything | <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd> or <kbd>/</kbd> |
| Save while editing | <kbd>Ctrl</kbd>+<kbd>S</kbd> |
| Convert an accepted quote | Quotation → **Convert to invoice** |
| Get paid | Invoice → **Record payment** (issues a receipt) |
| Invite colleagues | **Settings → Team & access** (email link or invite code) |
| Employee directory | **People** |
| Switch workspace | Click the workspace name at the top of the sidebar |
| Sign out | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd> |

## Security model

| Control | Implementation |
| --- | --- |
| Authentication | Supabase Auth: email and password (8+ characters, common passwords rejected), or Google. Built-in rate limiting |
| Workspace isolation | Postgres Row Level Security on every table. Users can only read or write workspaces they belong to |
| Roles | Admin, Editor and Viewer are enforced in the database (viewers can't write, editors can't delete, only admins manage people) and mirrored in the UI |
| Membership changes | Only via `SECURITY DEFINER` functions that check the caller's role. The last admin can't be removed or demoted |
| Invitations | Random 256-bit links, single-use, valid for 7 days, bound to the invited email. Only a SHA-256 hash is stored |
| Invite codes | Only let someone *request* to join, and an admin must approve. Admins can regenerate or disable the code |
| Audit log | Append-only. The server stamps who acted and when. Only admins can read it, and nobody can edit it |
| Sessions | Admin-configurable sign-out after inactivity (with a warning) and optional sign-out for hidden tabs |
| Transport and storage | HTTPS/TLS everywhere. Supabase encrypts the database and backups at rest |
| Browser hardening | Strict CSP (self-hosted scripts and fonts; Supabase is the only third-party origin), plus `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` and COOP headers (`vite.config.ts`, `public/_headers`) |
| Uploads | Logos and signatures: PNG, JPG or WebP up to 512 KB, verified to decode as images |

Database tests covering these rules live alongside the migration history. The policies are in
`supabase/migrations/0001_workspaces.sql`.

## Project structure

```
supabase/migrations/   database schema, access rules and functions
src/
  cloud/               Supabase client, record sync and realtime, team operations
  security/            session, roles and permissions, password policy
  store/               zustand stores (cloud-synced)
  components/          layout, document renderer and templates, UI kit
  pages/               dashboard, documents, clients, people, settings, auth/onboarding
```
