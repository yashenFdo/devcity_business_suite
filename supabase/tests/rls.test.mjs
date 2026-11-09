// Run: npm run test:db — applies the migration to an in-memory Postgres (PGlite)
// with a stubbed Supabase auth layer, then checks every access rule as different users.
// Tests the Supabase migration on real Postgres (PGlite) with a stubbed Supabase auth layer.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const MIGRATION = readFileSync(new URL('../migrations/0001_workspaces.sql', import.meta.url), 'utf8');
const db = new PGlite();
let failures = 0;
const ok = (c, m) => {
  console.log(c ? '  ✓' : '  ✗ FAIL', m);
  if (!c) failures++;
};

// ── Supabase-like environment ──
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`);
await db.exec(MIGRATION);
console.log('Migration applied');

const U = {
  alice: '00000000-0000-0000-0000-00000000000a', // creates workspace (admin)
  bob: '00000000-0000-0000-0000-00000000000b', // invited by email (editor)
  carol: '00000000-0000-0000-0000-00000000000c', // joins by code → approved viewer
  mallory: '00000000-0000-0000-0000-00000000000d', // outsider
};
for (const [name, id] of Object.entries(U)) {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, `${name}@devcity.us`, { full_name: name[0].toUpperCase() + name.slice(1) }]);
}
ok((await db.query(`select count(*)::int c from public.profiles`)).rows[0].c === 4, 'profiles auto-created for new users');

/** Run as an authenticated user (RLS enforced). */
const as = async (who, sql, params = []) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${who ? U[who] : ''}', false); set role ${who ? 'authenticated' : 'anon'};`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role;');
  }
};
const fails = async (who, sql, params = [], match) => {
  try {
    await as(who, sql, params);
    return false;
  } catch (e) {
    return match ? String(e.message).toLowerCase().includes(match.toLowerCase()) : true;
  }
};

console.log('Create workspace');
const ws = (await as('alice', `select public.create_workspace('DevCity', '{"name":"DevCity"}') id`)).rows[0].id;
ok(!!ws, 'alice creates a workspace');
ok((await as('alice', `select public.my_role($1) r`, [ws])).rows[0].r === 'admin', 'creator is admin');
const code = (await as('alice', `select join_code from public.workspaces where id = $1`, [ws])).rows[0].join_code;
ok(/^DEV-[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(code), `join code format ${code}`);
ok((await as('mallory', `select * from public.workspaces`)).rows.length === 0, 'outsider cannot see the workspace');
ok(await fails('mallory', `insert into public.workspaces (name, join_code, created_by) values ('x','y',$1)`, [U.mallory]), 'no direct workspace inserts');

console.log('Email invitation');
const token = (await as('alice', `select public.invite_member($1, 'BOB@devcity.us', 'editor') t`, [ws])).rows[0].t;
ok(token.length === 64, 'admin gets a 64-char invite token');
ok(await fails('bob', `select public.invite_member($1, 'x@y.io', 'admin')`, [ws], 'Only administrators'), 'non-member cannot invite');
const preview = (await as(null, `select * from public.get_invitation($1)`, [token])).rows[0];
ok(preview?.workspace_name === 'DevCity' && preview.status === 'pending' && preview.inviter_name === 'Alice', 'anonymous invitation preview works');
ok((await as('alice', `select token_hash from public.workspace_invitations`)).rows[0].token_hash !== token, 'only a hash of the token is stored');
ok(await fails('mallory', `select public.accept_invitation($1)`, [token], 'Sign in with that email'), 'wrong email cannot accept');
ok((await as('bob', `select * from public.my_invitations()`)).rows.length === 1, 'bob sees his pending invitation');
ok((await as('bob', `select public.accept_invitation($1) w`, [token])).rows[0].w === ws, 'bob accepts');
ok((await as('bob', `select public.my_role($1) r`, [ws])).rows[0].r === 'editor', 'bob is editor');
ok(await fails('bob', `select public.accept_invitation($1)`, [token], 'already been used'), 'token is single-use');
ok(await fails(null, `select * from public.workspace_invitations`), 'anon cannot read invitations table');

console.log('Invite code + approval');
ok(await fails('carol', `select public.request_to_join('DEV-WRONG-CODE0')`, [], 'not valid'), 'bad code rejected');
ok((await as('carol', `select public.request_to_join($1, 'Hi, new designer') n`, [code.toLowerCase()])).rows[0].n === 'DevCity', 'valid code (case-insensitive) creates a request');
ok((await as('carol', `select public.my_role($1) r`, [ws])).rows[0].r === null, 'pending request grants no access');
ok((await as('carol', `select * from public.records`)).rows.length === 0, 'pending user sees no records');
const reqs = (await as('alice', `select id from public.join_requests where status = 'pending'`)).rows;
ok(reqs.length === 1, 'admin sees the join request');
ok((await as('alice', `select full_name from public.profiles where id = $1`, [U.carol])).rows[0]?.full_name === 'Carol', "admin sees the requester's name");
ok((await as('bob', `select full_name from public.profiles where id = $1`, [U.carol])).rows.length === 0, "non-admins don't see requesters");
ok(await fails('bob', `select public.decide_join_request($1, true, 'admin')`, [reqs[0].id]), 'editor cannot approve');
await as('alice', `select public.decide_join_request($1, true, 'viewer')`, [reqs[0].id]);
ok((await as('carol', `select public.my_role($1) r`, [ws])).rows[0].r === 'viewer', 'approved as viewer');
await as('alice', `update public.workspaces set join_code_enabled = false where id = $1`, [ws]);
ok(await fails('mallory', `select public.request_to_join($1)`, [code], 'not valid'), 'disabled code rejected');
ok(await fails('alice', `update public.workspaces set join_code = 'DEV-AAAAA-AAAAA' where id = $1`, [ws]), 'join code cannot be set directly');
const newCode = (await as('alice', `select public.regenerate_join_code($1) c`, [ws])).rows[0].c;
ok(newCode !== code, 'admin regenerates code');

console.log('Records & roles');
await as('bob', `insert into public.records (workspace_id, collection, id, number, data, created_by) values ($1,'invoices','i1','DEV-INV-2026-001','{"total":100}', $2)`, [ws, U.alice]);
ok((await as('alice', `select created_by from public.records where id='i1'`)).rows[0].created_by === U.bob, 'created_by is forced to the real author');
ok((await as('carol', `select count(*)::int c from public.records`)).rows[0].c === 1, 'viewer can read records');
ok(await fails('carol', `insert into public.records (workspace_id, collection, id, data) values ($1,'invoices','i2','{}')`, [ws]), 'viewer cannot create');
const upd = await as('carol', `update public.records set data='{"total":1}' where id='i1'`);
ok(upd.affectedRows === 0, 'viewer cannot update');
ok(await fails('bob', `insert into public.records (workspace_id, collection, id, number, data) values ($1,'invoices','i3','DEV-INV-2026-001','{}')`, [ws], 'duplicate'), 'duplicate document number rejected');
const del = await as('bob', `delete from public.records where id='i1'`);
ok(del.affectedRows === 0, 'editor cannot delete');
ok((await as('mallory', `select * from public.records`)).rows.length === 0, 'outsider sees nothing');
ok(await fails('mallory', `insert into public.records (workspace_id, collection, id, data) values ($1,'invoices','x','{}')`, [ws]), 'outsider cannot write');

console.log('Audit log');
await as('bob', `insert into public.audit_log (workspace_id, actor_id, actor_name, category, action) values ($1, $2, 'Alice', 'document', 'Created invoice')`, [ws, U.alice]);
const entry = (await as('alice', `select actor_id, actor_name from public.audit_log`)).rows[0];
ok(entry.actor_id === U.bob && entry.actor_name === 'Bob', 'audit actor stamped by server (no spoofing)');
ok((await as('bob', `select * from public.audit_log`)).rows.length === 0, 'non-admins cannot read the audit log');
ok((await as('alice', `update public.audit_log set action='x'`).catch(() => ({ affectedRows: -1 }))).affectedRows <= 0, 'audit log cannot be edited');
ok(await fails('mallory', `insert into public.audit_log (workspace_id, actor_name, category, action) values ($1,'M','auth','x')`, [ws]), 'outsider cannot write audit');

console.log('Employee directory');
await as('alice', `select public.update_member($1, $2, null, 'Senior Engineer', 'Engineering', null, '2026-01-10', null)`, [ws, U.bob]);
const bobRow = (await as('carol', `select job_title, department from public.workspace_members where user_id = $1`, [U.bob])).rows[0];
ok(bobRow.job_title === 'Senior Engineer' && bobRow.department === 'Engineering', 'colleagues see directory details');
ok(await fails('bob', `select public.update_member($1, $2, 'admin')`, [ws, U.bob], 'Only administrators'), 'member cannot promote self');
await as('bob', `select public.update_member($1, $2, null, null, null, '+94 77 123 4567')`, [ws, U.bob]);
ok((await as('alice', `select phone from public.workspace_members where user_id=$1`, [U.bob])).rows[0].phone === '+94 77 123 4567', 'member can update own phone');
ok(await fails('bob', `update public.workspace_members set role='admin' where user_id=$1`, [U.bob]), 'no direct member table edits');
ok((await as('bob', `select email from public.profiles where id=$1`, [U.carol])).rows.length === 1, 'colleague profiles visible');
ok((await as('mallory', `select email from public.profiles where id=$1`, [U.bob])).rows.length === 0, 'outsiders cannot see profiles');

console.log('Admin safety & leaving');
ok(await fails('alice', `select public.update_member($1, $2, 'viewer')`, [ws, U.alice], 'at least one administrator'), 'last admin cannot demote self');
ok(await fails('alice', `select public.remove_member($1, $2)`, [ws, U.alice], 'at least one administrator'), 'last admin cannot leave');
await as('alice', `select public.update_member($1, $2, null, null, null, null, null, 'left')`, [ws, U.carol]);
ok((await as('carol', `select count(*)::int c from public.records`)).rows[0].c === 0, 'status "left" revokes access immediately');
await as('alice', `select public.remove_member($1, $2)`, [ws, U.bob]);
ok((await as('bob', `select public.my_role($1) r`, [ws])).rows[0].r === null, 'removed member loses access');
ok(await fails('bob', `select public.remove_member($1, $2)`, [ws, U.alice]), 'removed member cannot remove others');

console.log('Function lockdown');
ok(await fails(null, `select public.create_workspace('x')`), 'anon cannot call create_workspace');
ok(await fails('mallory', `select public.accept_invitation_row(null::public.workspace_invitations)`), 'internal helper not callable');

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL DATABASE SECURITY TESTS PASSED');
process.exitCode = failures ? 1 : 0;
