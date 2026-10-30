#!/usr/bin/env node
/**
 * Local development PostgreSQL helper.
 *
 * Manages a dedicated, self-contained PostgreSQL cluster for local testing so you
 * don't need your system Postgres password. It runs on its own port (default 5433)
 * with a data directory outside the project, and uses trust auth (local dev only).
 *
 * Usage:
 *   node scripts/local-db.mjs up       # init (first time) + start + create db
 *   node scripts/local-db.mjs start    # start the cluster
 *   node scripts/local-db.mjs stop     # stop the cluster
 *   node scripts/local-db.mjs status   # is it running?
 *   node scripts/local-db.mjs reset    # stop + delete the data dir (destroys data)
 *
 * Env overrides: LOCAL_DB_PORT, LOCAL_DB_DIR, LOCAL_DB_NAME, PG_BIN
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const PORT = process.env.LOCAL_DB_PORT || "5433";
const DB_NAME = process.env.LOCAL_DB_NAME || "real_estate_tool";
const DATA_DIR =
  process.env.LOCAL_DB_DIR ||
  path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), ".local", "share"), "real-estate-tool", "pgdata");
const HOST = "127.0.0.1";

function findPgBin() {
  if (process.env.PG_BIN && existsSync(process.env.PG_BIN)) return process.env.PG_BIN;
  // Common Windows install locations: pick the highest version.
  const roots = ["C:/Program Files/PostgreSQL", "C:/Program Files (x86)/PostgreSQL"];
  for (const root of roots) {
    if (existsSync(root)) {
      const versions = readdirSync(root)
        .filter((v) => /^\d+$/.test(v))
        .sort((a, b) => Number(b) - Number(a));
      for (const v of versions) {
        const bin = path.join(root, v, "bin");
        if (existsSync(path.join(bin, process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl"))) return bin;
      }
    }
  }
  // Fall back to PATH (posix / Homebrew / apt).
  return "";
}

const BIN = findPgBin();
const exe = (name) => (BIN ? path.join(BIN, process.platform === "win32" ? `${name}.exe` : name) : name);

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return { code: res.status ?? 1, out: (res.stdout || "") + (res.stderr || "") };
}

function isRunning() {
  const res = run(exe("pg_isready"), ["-h", HOST, "-p", PORT]);
  return res.code === 0;
}

function connUrl() {
  return `postgresql://postgres@${HOST}:${PORT}/${DB_NAME}`;
}

function init() {
  if (existsSync(path.join(DATA_DIR, "PG_VERSION"))) return;
  mkdirSync(DATA_DIR, { recursive: true });
  console.log(`Initializing a local dev database in ${DATA_DIR} ...`);
  const res = run(exe("initdb"), ["-D", DATA_DIR, "-U", "postgres", "--auth-local=trust", "--auth-host=trust", "-E", "UTF8"]);
  if (res.code !== 0) {
    console.error(res.out);
    process.exit(1);
  }
}

function start() {
  if (isRunning()) {
    console.log(`Local dev database already running on ${HOST}:${PORT}.`);
    return;
  }
  const logFile = path.join(DATA_DIR, "server.log");
  // Launch detached with stdio 'ignore'. Without this, spawnSync keeps the
  // server's inherited output pipe open and never returns (the server writes to
  // the pipe for its whole lifetime). The server writes to -l logFile instead.
  spawnSync(exe("pg_ctl"), [
    "-D", DATA_DIR,
    "-o", `-p ${PORT} -c listen_addresses=${HOST}`,
    "-l", logFile,
    "start",
  ], { stdio: "ignore", detached: true });
  for (let i = 0; i < 30; i++) {
    if (isRunning()) {
      console.log(`Local dev database running on ${HOST}:${PORT}.`);
      return;
    }
    const until = Date.now() + 500;
    while (Date.now() < until) {
      /* brief spin-wait so we don't need an async sleep */
    }
  }
  console.error("Database did not become ready in time. Check the server log in the data directory.");
  process.exit(1);
}

function ensureDb() {
  // createdb returns non-zero if it already exists; that's fine.
  run(exe("createdb"), ["-h", HOST, "-p", PORT, "-U", "postgres", DB_NAME]);
}

function stop() {
  if (!existsSync(path.join(DATA_DIR, "PG_VERSION"))) {
    console.log("No local dev database to stop.");
    return;
  }
  run(exe("pg_ctl"), ["-D", DATA_DIR, "stop", "-m", "fast"]);
  console.log("Local dev database stopped.");
}

const cmd = process.argv[2] || "up";
switch (cmd) {
  case "up":
    if (!BIN && !commandExists("pg_ctl")) {
      console.error(
        "Could not find PostgreSQL binaries. Install PostgreSQL, or set PG_BIN to its bin folder, or use Docker (docker compose up -d).",
      );
      process.exit(1);
    }
    init();
    start();
    ensureDb();
    console.log(`\nReady. Put this in your .env:\n  DATABASE_URL=${connUrl()}\n`);
    break;
  case "start":
    start();
    break;
  case "stop":
    stop();
    break;
  case "status":
    console.log(isRunning() ? `running on ${HOST}:${PORT}` : "not running");
    break;
  case "reset":
    stop();
    rmSync(DATA_DIR, { recursive: true, force: true });
    console.log(`Deleted ${DATA_DIR}.`);
    break;
  default:
    console.error(`Unknown command: ${cmd}. Use up | start | stop | status | reset.`);
    process.exit(1);
}

function commandExists(name) {
  const which = process.platform === "win32" ? "where" : "which";
  return run(which, [name]).code === 0;
}
