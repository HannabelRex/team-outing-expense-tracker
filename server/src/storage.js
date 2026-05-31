import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '..', 'data', 'store.json');
const DATABASE_URL = process.env.DATABASE_URL;

let pool;
let databaseReady = false;
let seedData;

function useDatabase() {
  return Boolean(DATABASE_URL);
}

async function readSeedData() {
  if (!seedData) {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    seedData = JSON.parse(raw);
  }
  return structuredClone(seedData);
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
    });
  }
  return pool;
}

async function ensureDatabase() {
  if (!useDatabase() || databaseReady) return;

  const client = await getPool().connect();
  try {
    await client.query(`
      create table if not exists app_state (
        id text primary key,
        data jsonb not null,
        updated_at timestamptz not null default now()
      )
    `);

    const existing = await client.query('select id from app_state where id = $1', ['default']);
    if (existing.rowCount === 0) {
      const seed = await readSeedData();
      await client.query('insert into app_state (id, data) values ($1, $2::jsonb)', ['default', JSON.stringify(seed)]);
    }

    databaseReady = true;
  } finally {
    client.release();
  }
}

export async function readStore() {
  if (!useDatabase()) {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  }

  await ensureDatabase();
  const result = await getPool().query('select data from app_state where id = $1', ['default']);
  return result.rows[0].data;
}

export async function writeStore(data) {
  if (!useDatabase()) {
    const tmpFile = `${DATA_FILE}.tmp`;
    await fs.writeFile(tmpFile, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmpFile, DATA_FILE);
    return data;
  }

  await ensureDatabase();
  await getPool().query(
    `insert into app_state (id, data, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (id) do update set data = excluded.data, updated_at = now()`,
    ['default', JSON.stringify(data)]
  );
  return data;
}

export function sanitizeText(value) {
  return typeof value === 'string' ? value.trim() : value;
}

export function sanitizeObject(object = {}) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, sanitizeText(value)]));
}
