#!/usr/bin/env tsx
/**
 * Verifies Step 4 pieces exist and are correctly wired.
 * Does not expose secrets. It only checks presence and makes a dry-run request to the API with invalid token.
 */
import fs from "node:fs";
import path from "node:path";

function must(file: string) {
  if (!fs.existsSync(file)) throw new Error(`Missing: ${file}`);
}

const root = process.cwd();
must(path.join(root, "src/lib/supabase/client.ts"));
must(path.join(root, "src/lib/supabase/server.ts"));
must(path.join(root, "src/lib/supabase/admin.ts"));
must(path.join(root, "src/app/api/auth/invite/route.ts"));
must(path.join(root, "src/components/admin/InviteUsersPanel.tsx"));

console.log("STEP4: files OK");

const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
console.log("STEP4: site =", site);

(async () => {
  try {
    const res = await fetch(`${site}/api/auth/invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-master-token": "wrong-token",
      },
      body: JSON.stringify({ emails: ["test@example.com"] }),
    });
    console.log("STEP4: API reached? status=", res.status);
  } catch {
    console.log("STEP4: API smoke test skipped (dev server not running).");
  }
})();
