const fs = require("node:fs/promises");
const path = require("node:path");
const FORMAT = "payday.encrypted.v1";
function createVaultStorage({ directory, safeStorage, schema }) {
  const target = path.join(directory, "payday-vault.json");
  function encode(value) {
    if (!safeStorage.isEncryptionAvailable())
      throw new Error(
        "Windows encryption is unavailable. The vault was not written.",
      );
    return {
      format: FORMAT,
      ciphertext: safeStorage
        .encryptString(JSON.stringify(schema.parse(value)))
        .toString("base64"),
    };
  }
  function decode(value) {
    if (value?.format === FORMAT) {
      if (!safeStorage.isEncryptionAvailable())
        throw new Error(
          "Windows cannot unlock this vault. Sign in to its original Windows account.",
        );
      try {
        return schema.parse(
          JSON.parse(
            safeStorage.decryptString(Buffer.from(value.ciphertext, "base64")),
          ),
        );
      } catch {
        throw new Error(
          "This encrypted vault could not be unlocked or is damaged. The original file was kept intact.",
        );
      }
    }
    return schema.parse(value);
  }
  async function write(value) {
    const envelope = encode(value),
      tmp = target + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(envelope), "utf8");
    await fs.rename(tmp, target);
  }
  async function read() {
    let raw;
    try {
      raw = JSON.parse(await fs.readFile(target, "utf8"));
    } catch (e) {
      if (e.code === "ENOENT") return null;
      throw new Error(
        "The local vault could not be read. The original file was kept intact.",
      );
    }
    const value = decode(raw);
    if (raw.format !== FORMAT) await write(value);
    return value;
  }
  return { read, write, encode, decode };
}
module.exports = { createVaultStorage, FORMAT };
