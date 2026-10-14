#!/usr/bin/env node
// Create the ONE Developer account. Run it yourself, in your own terminal:
//
//   Local:       node scripts/create-developer.mjs
//   Production:  DATABASE_URL="postgresql://…neon…" node scripts/create-developer.mjs
//
// • The password is typed at a hidden prompt — it is never in source, in shell
//   history, or in any log.
// • It generates the authenticator (TOTP) secret and shows it ONCE. Add it to your
//   authenticator app, then store the same value as DEV_TOTP_SECRET in Vercel
//   (Production) — without it the Developer login refuses everyone (fail-closed).
// • Refuses to run if a Developer account already exists, or if the database
//   hasn't had scripts/developer-account.sql applied yet.

import { ask as askPlain, askHidden } from "./_prompt.mjs";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32(buf) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

// ask() shows what you type; askHidden() never does (see _prompt.mjs).
// `ask(q, { hidden: true })` is kept as a thin alias so every secret goes through askHidden.
const ask = (q, { hidden = false } = {}) => (hidden ? askHidden(q).then((s) => s.trim()) : askPlain(q));

function strongEnough(pw) {
  if (pw.length < 14) return "Use at least 14 characters.";
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes < 3) return "Mix at least three of: lowercase, uppercase, digits, symbols.";
  if (/^(.)\1+$/.test(pw)) return "That's too repetitive.";
  return null;
}

let prisma;
try {
  // Which database? ALWAYS ask (hidden) — never trust whatever DATABASE_URL happens
  // to be set in the terminal, which is how it once silently pointed at the local
  // test database. (CREATE_DEV_DB_URL can pre-answer it for automation.) An empty
  // answer = the local test database.
  let url = (process.env.CREATE_DEV_DB_URL ?? "").trim();
  if (!/^postgres(ql)?:\/\//.test(url)) {
    url = await ask(
      "\nPaste your database URL (it starts with postgresql://, hidden as you paste).\nPress Enter instead to use the LOCAL test database: ",
      { hidden: true },
    );
  }
  if (url && !/^postgres(ql)?:\/\//.test(url)) {
    console.log("That doesn't look like a database URL — it must start with postgresql://   Nothing was changed.");
    process.exit(1);
  }
  prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
  const host = url ? (url.match(/@([^/:?]+)/) || [])[1] ?? "(unknown host)" : "LOCAL database (.env)";
  console.log(`\nTarget database: ${host}`);
  const go = await ask("Create the Developer account on THIS database? (yes/no): ");
  if (go.toLowerCase() !== "yes") { console.log("Cancelled."); process.exit(0); }

  const existing = await prisma.user.findFirst({ where: { role: "DEVELOPER" }, select: { email: true } });
  if (existing) { console.log(`A Developer account already exists (${existing.email}). Nothing changed.`); process.exit(0); }

  const name = await ask("Your name (shown in the audit log): ");
  const email = (await ask("Developer email: ")).toLowerCase();
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) { console.log("Need a name and a valid email."); process.exit(1); }
  if (await prisma.user.findUnique({ where: { email } })) { console.log("That email is already used by another account."); process.exit(1); }

  // Keep asking until the password is strong AND typed twice the same — a typo or
  // a too-short password never drops you out of the script.
  console.log("\nChoose a NEW password: at least 14 characters, e.g. a few words, dashes and numbers.");
  console.log("Don't reuse a password you've shown anyone or typed anywhere else.");
  let pw = "";
  for (let attempt = 1; ; attempt++) {
    if (attempt > 6) { console.log("Too many tries. Nothing was created."); process.exit(1); }
    pw = await askHidden("Choose a password (hidden): ");
    const weak = strongEnough(pw);
    if (weak) { console.log(`  ✗ ${weak} Try again.`); continue; }
    if (pw === (await askHidden("Repeat the password: "))) break;
    console.log("  ✗ The two passwords didn't match. Try again.");
  }

  const secret = base32(randomBytes(20));
  let user;
  try {
    user = await prisma.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(pw, 12), role: "DEVELOPER", status: "ACTIVE" },
    });
  } catch (e) {
    if (String(e?.message).includes("DEVELOPER")) {
      console.log("\nThe database doesn't know the DEVELOPER role yet. Apply scripts/developer-account.sql first.");
      process.exit(1);
    }
    throw e;
  }
  await prisma.activityLog.create({
    data: {
      actorId: user.id,
      actorName: `${name} (Developer)`,
      action: "DEV_ACCOUNT_CREATED",
      entity: "User",
      entityId: user.id,
      summary: `Developer account created for ${name} (${email}).`,
      meta: { developer: true, outcome: "SUCCESS", via: "scripts/create-developer.mjs" },
    },
  });

  console.log(`
✔ Developer account created for ${email}

NEXT — authenticator (shown only once, store it safely):
  Secret : ${secret}
  URI    : otpauth://totp/ORA%20OS:${encodeURIComponent(email)}?secret=${secret}&issuer=ORA%20OS

  1. Add it to your authenticator app (enter the secret manually, or turn the URI into a QR).
  2. Set this environment variable, then redeploy / restart:
       DEV_TOTP_SECRET=${secret}
     (Vercel → Project → Settings → Environment Variables → Production; locally put it in .env.local)
  3. Sign in at /login → "Developer login".
`);
} finally {
  await prisma?.$disconnect();
}
