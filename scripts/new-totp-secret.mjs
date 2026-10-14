#!/usr/bin/env node
// Make a FRESH authenticator secret for the Developer login.
//
// The secret is NEVER printed to the screen (anything printed can end up in logs,
// screen shares or a chat transcript). Instead it is:
//   • saved to a private file on your Desktop (only you can read it), and
//   • copied to your clipboard (macOS),
// then you add it to your phone + Vercel and DELETE the file.
//
// It does not touch any database. Run:  node scripts/new-totp-secret.mjs
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
let bits = 0, value = 0, secret = "";
for (const byte of randomBytes(20)) {
  value = (value << 8) | byte;
  bits += 8;
  while (bits >= 5) { secret += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
}
if (bits > 0) secret += B32[(value << (5 - bits)) & 31];

const file = join(homedir(), "Desktop", "ORA-SECRET-delete-after-use.txt");
writeFileSync(
  file,
  `ORA Developer authenticator secret — PRIVATE. Delete this file when you're done.

SECRET:  ${secret}

1. Phone authenticator app → Add → "Enter a setup key"
     Account: ORA     Key: the SECRET above     Type: time-based
   (Delete any older ORA entry — it no longer works.)
2. Vercel → ORA project → Settings → Environment Variables
     Name: DEV_TOTP_SECRET     Value: the SECRET above     Environment: Production
   (If it already exists, EDIT it — don't add a second one.)
3. Vercel → Deployments → ⋯ on the latest → Redeploy.
4. Login page → Developer login → email, password, 6-digit code from your phone.
5. DELETE THIS FILE (drag it to the Bin and empty the Bin).
`,
  { mode: 0o600 },
);

let copied = false;
if (process.platform === "darwin") {
  copied = spawnSync("pbcopy", { input: secret }).status === 0;
}

console.log(`
✔ A new secret was created. It is NOT shown here on purpose.

   • Saved to:  ${file}
   • ${copied ? "Also copied to your clipboard — you can paste it straight into Vercel." : "(Could not copy to the clipboard — open the file instead.)"}

Open that file, follow the 5 steps inside, and delete it when finished.
`);
