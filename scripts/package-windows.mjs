import { spawn } from "node:child_process";
import { readFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
if (!/^\d+\.\d+\.\d+$/.test(version))
  throw new Error("Expected a numeric release version.");
const stage = path.join(root, ".packaging", version),
  release = path.join(root, "release");
// Build away from any previously launched unpacked app: never close a user's app or overwrite its running files.
const code = await new Promise((resolve, reject) => {
  const child = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/electron-builder/cli.js"),
      "--win",
      "nsis",
      "--publish",
      "never",
      `--config.directories.output=${stage}`,
    ],
    { cwd: root, stdio: "inherit", windowsHide: true },
  );
  child.on("error", reject);
  child.on("exit", resolve);
});
if (code !== 0)
  throw new Error(
    `Windows packaging failed (${code}); previous installers were preserved.`,
  );
await mkdir(release, { recursive: true });
for (const suffix of [".exe", ".exe.blockmap"]) {
  const name = `Payday-Setup-${version}${suffix}`;
  await copyFile(path.join(stage, name), path.join(release, name));
}
await copyFile(path.join(stage, "latest.yml"), path.join(release, "latest.yml"));
await import("./clean-release.mjs");
