import { parseEnv } from "@/lib/env";

// Validated environment singleton. Importing this module runs validation at
// load time, so a missing/invalid var fails fast with a readable error instead
// of crashing deep in a request. Only ever imported server-side (it reads
// process.env / holds secrets); never import it from a client component.
export const env = parseEnv(process.env);
