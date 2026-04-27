/**
 * Cross-platform replacement for the previous `sh -c` preinstall hook.
 * Removes lockfiles from other package managers and enforces pnpm.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

for (const name of ["package-lock.json", "yarn.lock"]) {
  const filePath = path.join(root, name);
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

const ua = process.env.npm_config_user_agent || "";
if (!/^pnpm\//.test(ua)) {
  console.error("Use pnpm instead");
  process.exit(1);
}
