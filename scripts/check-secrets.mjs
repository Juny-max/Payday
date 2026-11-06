import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const roots=['src','electron','public','build','tests','scripts','.github'];
const top=['.gitignore','package.json','package-lock.json','index.html','tsconfig.json','vite.config.ts','README.md','SECURITY.md','LICENSE'];
const omitted=new Set(['electron/model.cjs','scripts/probe-gemini.cjs','scripts/probe-gemini.mjs','scripts/design-compare.mjs']);
const binary=new Set(['public/icon.ico','public/icon.png']);
async function walk(dir){let result=[];for(const entry of await readdir(path.join(root,dir),{withFileTypes:true})){const name=`${dir}/${entry.name}`;if(entry.isSymbolicLink())throw Error(`Symlink rejected: ${name}`);if(omitted.has(name))continue;result.push(...entry.isDirectory()?await walk(name):[name]);}return result;}
export async function reviewFiles(){
 const files=[...top];for(const dir of roots)files.push(...await walk(dir));
 const checks=[/AIza[0-9A-Za-z_-]{30,}/,/gh[pousr]_[A-Za-z0-9]{25,}/,/github_pat_[A-Za-z0-9_]{25,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/AKIA[0-9A-Z]{16}/,/https?:\/\/[^\s"']*:[^\s"'@]+@/];
 for(const file of files){if(/(?:^|\/)(?:\.env[^/]*|payday-(?:vault|key)[^/]*\.json)$/.test(file))throw Error(`Private file rejected: ${file}`);if(binary.has(file))continue;const text=await readFile(path.join(root,file),'utf8');if(checks.some(re=>re.test(text)))throw Error(`Potential secret detected in ${file}; value withheld`);if(/C:[\\/]+Users[\\/]+ELITEBOOK/i.test(text))throw Error(`Personal local path detected in ${file}`);}
 return [...new Set(files)].sort();
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const files=await reviewFiles();console.log(`PASS: ${files.length} allowlisted source files checked; no matching credentials, vaults or private keys. Diagnostic captures and app data excluded.`);
 if(process.argv.includes('--manifest'))await writeFile(path.join(root,'artifacts/publish-manifest.json'),JSON.stringify(files,null,2));
}
