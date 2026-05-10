import pg from "pg";

const { Pool } = pg;
type QueryResultRow = pg.QueryResultRow;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  return pool.query<T>(text, params);
}

export async function closePool() {
  await pool.end();
}
