import { cp, mkdir } from "node:fs/promises";
import { join } from "node:path";

// Next's standalone output omits assets intended for a CDN. Local browser E2E
// needs them served from the same origin as the bundled production server.
const root = process.cwd();
const standalone = join(root, ".next", "standalone");
await mkdir(join(standalone, ".next"), { recursive: true });
await cp(join(root, "public"), join(standalone, "public"), { recursive: true });
await cp(join(root, ".next", "static"), join(standalone, ".next", "static"), { recursive: true });
await import("../.next/standalone/server.js");
