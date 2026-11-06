import ts from "typescript";
import { readFile, writeFile } from "node:fs/promises";
const source = await readFile(
  new URL("../src/model.ts", import.meta.url),
  "utf8",
);
const result = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
});
await writeFile(
  new URL("../electron/model.cjs", import.meta.url),
  "// Generated from src/model.ts. Do not edit.\n" + result.outputText,
);
