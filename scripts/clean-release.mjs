import { readdir, unlink, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const release = path.join(root, "release");
const { version } = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const latest = await stat(path.join(release, `Payday Setup ${version}.exe`));
if (latest.size < 1000000)
  throw new Error(
    "Latest installer is missing or incomplete; old installers have been preserved.",
  );
for (const name of await readdir(release)) {
  const match = /^Payday Setup (\d+\.\d+\.\d+)\.exe(?:\.blockmap)?$/.exec(name);
  if (!match || match[1] === version) continue;
  const target = path.resolve(release, name);
  if (path.dirname(target) !== release)
    throw new Error("Release path is outside the intended folder.");
  await unlink(target);
  console.log(`Removed superseded installer artifact: ${name}`);
}
