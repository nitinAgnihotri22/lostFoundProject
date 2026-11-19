/*
  Create (or reset) a super admin for /admin.

  Usage:
    npm run admin:create
    npm run admin:create -- --email you@example.com --name "Your Name"

  Asks for the password. Reads NEXT_PUBLIC_SUPABASE_URL and
  SUPABASE_SERVICE_ROLE_KEY from .env.local / .env (or the environment).
  Run supabase/migrations/07_admin_panel.sql first.

  If the email already belongs to an admin, you'll be asked whether to
  reset that account's password and make it an active super admin.
*/
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { createClient } from '@supabase/supabase-js';

// Load the same env files Next.js uses (first one wins per variable). Parsed by hand
// so it works on any Node version; variables already set in the shell take priority.
const ENV_FILES = ['.env.development.local', '.env.local', '.env.development', '.env'];
const found = [];
for (const f of ENV_FILES) {
  let text;
  try {
    text = fs.readFileSync(path.join(process.cwd(), f), 'utf8');
  } catch {
    continue;
  }
  found.push(f);
  for (const raw of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(raw);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    process.env[m[1]] = v;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(`Missing ${[!url && 'NEXT_PUBLIC_SUPABASE_URL', !key && 'SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean).join(' and ')}.`);
  console.error(`Looked in ${process.cwd()} for: ${ENV_FILES.join(', ')}`);
  console.error(found.length ? `Found: ${found.join(', ')} – but the variable(s) above aren't in them.` : 'None of those files exist here.');
  console.error('\nFix: add them to .env.local in the project folder, or pass them inline:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=your-key npm run admin:create');
  process.exit(1);
}

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
const ask = (q) => new Promise((res) => rl.question(q, (a) => res(a.trim())));

/** Ask without echoing what is typed. */
function askHidden(q) {
  return new Promise((res) => {
    const write = rl._writeToOutput;
    rl._writeToOutput = (s) => {
      if (s.includes(q)) write.call(rl, q);
    };
    rl.question(q, (a) => {
      rl._writeToOutput = write;
      process.stdout.write('\n');
      res(a);
    });
  });
}

// Same format as src/lib/auth.ts hashPassword().
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

try {
  const email = (arg('email') || (await ask('Admin email: '))).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('That is not a valid email.');

  const { data: existing, error: findErr } = await supabase.from('admin_users').select('*').eq('email', email).maybeSingle();
  if (findErr) throw new Error(`${findErr.message}\nDid you run supabase/migrations/07_admin_panel.sql?`);

  if (existing) {
    const yes = await ask(`${email} is already an admin (${existing.role}, ${existing.status}). Reset password and make it an active super admin? [y/N] `);
    if (yes.toLowerCase() !== 'y') throw new Error('Cancelled.');
  }
  const name = existing?.name || arg('name') || (await ask('Name: '));
  if (name.length < 2) throw new Error('Name must be at least 2 characters.');

  const password = await askHidden('Password (10+ chars, letters and numbers): ');
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('Password must be at least 10 characters with at least one letter and one number.');
  }
  const again = await askHidden('Repeat password: ');
  if (again !== password) throw new Error('Passwords do not match.');

  const now = new Date().toISOString();
  const row = {
    name,
    email,
    password_hash: hashPassword(password),
    role: 'super_admin',
    status: 'active',
    must_change_password: false,
    failed_attempts: 0,
    locked_until: null,
    updated_at: now,
  };
  const { error } = existing
    ? await supabase.from('admin_users').update({ ...row, session_version: (existing.session_version ?? 1) + 1 }).eq('id', existing.id)
    : await supabase.from('admin_users').insert({ ...row, id: crypto.randomUUID(), created_at: now });
  if (error) throw new Error(error.message);

  await supabase.from('admin_audit_log').insert({
    id: crypto.randomUUID(),
    admin_email: email,
    action: existing ? 'admin.cli_reset' : 'admin.cli_create',
    target_type: 'admin',
    details: { via: 'scripts/create_admin.mjs' },
    created_at: now,
  });

  console.log(`\n✔ ${existing ? 'Updated' : 'Created'} super admin ${email}. Sign in at /admin/login`);
} catch (e) {
  console.error(`\n✖ ${e.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
