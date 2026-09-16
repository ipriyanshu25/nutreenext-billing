import fs from "node:fs";
import path from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import pg from "pg";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function getArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function askText(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(prompt)).trim();
  } finally {
    rl.close();
  }
}

function askHidden(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== "function") {
    return askText(prompt);
  }

  return new Promise((resolve, reject) => {
    let value = "";
    const stdin = process.stdin;
    const stdout = process.stdout;
    const previousRaw = stdin.isRaw;

    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    function cleanup() {
      stdin.off("data", onData);
      stdin.setRawMode(Boolean(previousRaw));
      stdin.pause();
    }

    function onData(char) {
      if (char === "\u0003") {
        cleanup();
        stdout.write("\n");
        reject(new Error("Cancelled."));
        return;
      }

      if (char === "\r" || char === "\n") {
        cleanup();
        stdout.write("\n");
        resolve(value);
        return;
      }

      if (char === "\u007f" || char === "\b") {
        value = value.slice(0, -1);
        return;
      }

      if (char >= " ") value += char;
    }

    stdin.on("data", onData);
  });
}

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error("DATABASE_URL is missing from .env.local.");
  process.exit(1);
}

let username = getArg("username")?.trim();
let password = getArg("password");

try {
  if (!username) username = await askText("New login ID: ");
  if (!password) {
    password = await askHidden("New password: ");
    const confirmation = await askHidden("Confirm password: ");
    if (password !== confirmation) throw new Error("Passwords do not match.");
  }

  if (!/^[A-Za-z0-9._@-]{3,80}$/.test(username)) {
    throw new Error("Login ID must be 3-80 characters and use only letters, numbers, ., _, @ or -.");
  }
  if (password.length < 8 || password.length > 256) {
    throw new Error("Password must be between 8 and 256 characters.");
  }

  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_credentials (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        username TEXT NOT NULL UNIQUE,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    await client.query(
      `
        INSERT INTO admin_credentials (id, username, password_salt, password_hash, updated_at)
        VALUES (1, $1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          password_salt = EXCLUDED.password_salt,
          password_hash = EXCLUDED.password_hash,
          updated_at = EXCLUDED.updated_at
      `,
      [username, salt, hash, new Date().toISOString()],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  try {
    fs.writeFileSync(
      path.join(projectRoot, "data", "default-auth.json"),
      `${JSON.stringify({ username, salt, hash }, null, 2)}\n`,
      "utf8",
    );
    console.log("The source default-auth hash was updated too, so a fresh database will use the same login.");
  } catch {
    console.log("Database login was updated. The packaged default-auth file could not be rewritten in this environment.");
  }

  console.log(`Login updated successfully. Login ID: ${username}`);
  console.log("Existing signed-in browser sessions may remain valid until they expire or the user signs out.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
