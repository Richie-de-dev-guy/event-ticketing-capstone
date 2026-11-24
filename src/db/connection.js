import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const DEFAULT_DATABASE_PATH = fileURLToPath(new URL('../../data/ticketing.db', import.meta.url));
const SCHEMA = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

export function openDatabase(databasePath = process.env.DB_PATH ?? DEFAULT_DATABASE_PATH) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec(SCHEMA);
  return database;
}
