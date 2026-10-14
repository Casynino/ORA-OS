#!/usr/bin/env node
// Make a FRESH authenticator secret for the Developer login (e.g. if you didn't
// save the one create-developer.mjs showed). It does NOT touch any database — the
// secret lives only in your authenticator app and the DEV_TOTP_SECRET variable in
// Vercel (and .env.local for local testing). Run:  node scripts/new-totp-secret.mjs
import { randomBytes } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
let bits = 0, value = 0, secret = "";
for (const byte of randomBytes(20)) {
  value = (value << 8) | byte;
  bits += 8;
  while (bits >= 5) { secret += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
}
if (bits > 0) secret += B32[(value << (5 - bits)) & 31];

console.log(`
Your NEW authenticator secret (shown once — copy it now, don't paste it in chat):

   ${secret}

1. Authenticator app on your phone → Add → "Enter a setup key"
     Account: ORA     Key: the secret above     Type: time-based
   (If you added an older ORA entry, delete it — it will no longer work.)
2. Vercel → ORA project → Settings → Environment Variables
     Name:  DEV_TOTP_SECRET     Value: the secret above     Environment: Production
   (If DEV_TOTP_SECRET already exists, edit its value instead of adding a second one.)
3. Vercel → Deployments → ⋯ on the latest → Redeploy.
4. Login page → Developer login → email, password, 6-digit code.
`);
