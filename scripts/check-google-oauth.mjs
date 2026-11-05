/** Read-only Google OAuth setup helper. Never reads or prints private OAuth credentials. */
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const appOrigins = ["http://localhost:3000", "https://chessonline-hnquan.vercel.app"];
const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

console.log("Rookline Google OAuth configuration checklist\n");
console.log(`Supabase public URL: ${publicUrl ? "configured" : "MISSING"}`);
console.log(`Supabase publishable key: ${publishableConfigured ? "configured" : "MISSING"}`);

let callback = null;
if (publicUrl) {
  try {
    const url = new URL(publicUrl);
    if (url.protocol !== "https:") throw new Error("Expected an HTTPS Supabase project URL");
    callback = new URL("/auth/v1/callback", url).toString();
  } catch {
    console.error("Invalid NEXT_PUBLIC_SUPABASE_URL; use the HTTPS project URL from Supabase → Connect.");
  }
}

console.log("\nGoogle Cloud → Authorized redirect URIs:");
console.log(callback ?? "  https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback");
console.log("\nGoogle Cloud → Authorized JavaScript origins:");
for (const origin of appOrigins) console.log(`  ${origin}`);
console.log("\nSupabase Auth → Redirect URLs (add each exact site you operate):");
for (const origin of appOrigins) console.log(`  ${origin}/auth/callback?next=**`);
console.log("\nNote: The Google Client ID and Secret belong ONLY in Supabase Auth → Providers → Google.");
console.log("Do not copy them into .env.local, Git, or NEXT_PUBLIC_ variables.");
console.log("Details: docs/GOOGLE_OAUTH_SETUP.md");

if (!callback || !publishableConfigured) process.exitCode = 1;
