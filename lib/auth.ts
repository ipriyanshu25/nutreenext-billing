import { scryptSync, timingSafeEqual } from "node:crypto";
import type { QueryResultRow } from "pg";
import { queryDb } from "@/lib/db";

type CredentialRow = QueryResultRow & {
  username: string;
  password_salt: string;
  password_hash: string;
};

export async function verifyLoginCredentials(username: string, password: string) {
  const normalizedUsername = username.trim();
  if (!normalizedUsername || !password || password.length > 256) return false;

  const result = await queryDb<CredentialRow>(
    `SELECT username, password_salt, password_hash FROM admin_credentials WHERE id = 1 LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row || row.username !== normalizedUsername) return false;

  try {
    const expected = Buffer.from(row.password_hash, "hex");
    const actual = scryptSync(password, row.password_salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
