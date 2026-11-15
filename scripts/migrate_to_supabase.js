/*
  Migration script – move data from the local SQLite database (lostfound.db)
  into the Supabase PostgreSQL instance.

  Usage:
    npm run migrate

  Prerequisites:
    - .env.local must contain NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
      and SUPABASE_SERVICE_ROLE_KEY.
    - The Supabase tables (users, items, claims) must already exist – you can run the
      SQL from scripts/seed.sql (adapted for PostgreSQL) beforehand.
*/

import 'dotenv/config'; // Load .env.local
import { createClient } from '@supabase/supabase-js';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role key gives full write access
);

const DB_PATH = path.join(process.cwd(), 'lostfound.db');
const db = new DatabaseSync(DB_PATH);

async function migrateUsers() {
  const rows = db.prepare('SELECT * FROM users').all();
  console.log(`Migrating ${rows.length} users...`);
  for (const row of rows) {
    const { data, error } = await supabase.from('users').upsert({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      avatar: row.avatar,
      created_at: row.created_at,
    });
    if (error) {
      console.error('User upsert error', row.id, error);
    }
  }
}

async function migrateItems() {
  const rows = db.prepare('SELECT * FROM items').all();
  console.log(`Migrating ${rows.length} items...`);
  for (const row of rows) {
    const { data, error } = await supabase.from('items').upsert({
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      category: row.category,
      images: row.images,
      lat: row.lat,
      lng: row.lng,
      address: row.address,
      city: row.city,
      occurred_at: row.occurred_at,
      status: row.status,
      user_id: row.user_id,
      user_name: row.user_name,
      user_email: row.user_email,
      user_phone: row.user_phone,
      reward: row.reward,
      verification_questions: row.verification_questions,
      created_at: row.created_at,
    });
    if (error) {
      console.error('Item upsert error', row.id, error);
    }
  }
}

async function migrateClaims() {
  const rows = db.prepare('SELECT * FROM claims').all();
  console.log(`Migrating ${rows.length} claims...`);
  for (const row of rows) {
    const { data, error } = await supabase.from('claims').upsert({
      id: row.id,
      item_id: row.item_id,
      item_title: row.item_title,
      claimant_id: row.claimant_id,
      claimant_name: row.claimant_name,
      claimant_email: row.claimant_email,
      claimant_phone: row.claimant_phone,
      proof_1: row.proof_1,
      proof_2: row.proof_2,
      proof_3: row.proof_3,
      status: row.status,
      finder_notes: row.finder_notes,
      created_at: row.created_at,
    });
    if (error) {
      console.error('Claim upsert error', row.id, error);
    }
  }
}

async function main() {
  try {
    await migrateUsers();
    await migrateItems();
    await migrateClaims();
    console.log('✅ Migration completed');
  } catch (e) {
    console.error('Migration failed', e);
    process.exit(1);
  }
}

main();

