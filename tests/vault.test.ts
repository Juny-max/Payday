import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { initialVault, stateSchema } from "../src/model";
const { createVaultStorage } = createRequire(import.meta.url)(
  "../electron/vault-storage.cjs",
);
async function dir() {
  await mkdir("artifacts", { recursive: true });
  return mkdtemp(path.resolve("artifacts/vault-test-"));
}
test("unavailable encryption never replaces an existing plaintext vault", async () => {
  const directory = await dir(),
    file = path.join(directory, "payday-vault.json"),
    text = JSON.stringify(initialVault());
  await writeFile(file, text);
  const storage = createVaultStorage({
    directory,
    schema: stateSchema,
    safeStorage: { isEncryptionAvailable: () => false },
  });
  await assert.rejects(storage.read(), /encryption is unavailable/);
  assert.equal(await readFile(file, "utf8"), text);
  await assert.rejects(
    storage.write(initialVault()),
    /encryption is unavailable/,
  );
  assert.equal(await readFile(file, "utf8"), text);
});
test("corrupt ciphertext is rejected without resetting or overwriting the vault", async () => {
  const directory = await dir(),
    file = path.join(directory, "payday-vault.json"),
    text = JSON.stringify({
      format: "payday.encrypted.v1",
      ciphertext: "broken",
    });
  await writeFile(file, text);
  const storage = createVaultStorage({
    directory,
    schema: stateSchema,
    safeStorage: {
      isEncryptionAvailable: () => true,
      decryptString: () => {
        throw new Error("bad cipher");
      },
    },
  });
  await assert.rejects(storage.read(), /could not be unlocked/);
  assert.equal(await readFile(file, "utf8"), text);
});
