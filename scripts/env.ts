import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
const flag = process.argv.indexOf("--env");
if (flag >= 0) {
  if (!process.argv[flag + 1] || process.argv[flag + 1].startsWith("--"))
    throw new Error("--env requires an explicit environment file");
  loadEnvFile(process.argv[flag + 1]);
} else if (existsSync(".env.local")) loadEnvFile(".env.local");
else if (existsSync(".env")) loadEnvFile(".env");
