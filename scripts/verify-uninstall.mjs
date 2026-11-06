import {mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('artifacts',`uninstall-regression-${Date.now()}`);
await mkdir(root,{recursive:true});
const compiler=path.join(process.env.LOCALAPPDATA,'electron-builder/Cache/nsis-3.0.4.1/nsis-3.0.4.1-1mx3n/Bin/makensis.exe');
const source=`Unicode true
!include "FileFunc.nsh"
!include "${path.resolve('build/uninstall.nsh')}"
Name "Payday isolated cleanup verification"
OutFile "cleanup-test.exe"
RequestExecutionLevel user
SilentInstall silent
Var TestRoot
Section
  \${GetParameters} $R0
  \${GetOptions} $R0 "/CASE=" $TestRoot
  StrCpy $TestRoot "$EXEDIR\\$TestRoot"
  !insertmacro PaydayDeleteOwnedData "$TestRoot"
  FileOpen $0 "$TestRoot\\cleanup-result.txt" w
  FileWrite $0 "$R3"
  FileClose $0
SectionEnd
`;
await writeFile(path.join(root,'cleanup-test.nsi'),source);
const build=spawnSync(compiler,['/V2',path.join(root,'cleanup-test.nsi')],{encoding:'utf8',windowsHide:true});
assert.equal(build.status,0,build.stdout+build.stderr);
for(const children of [[],['payday-desktop'],['Payday'],['Payday','payday-desktop']]) {
 const fixture=path.join(root,`case-${children.join('-')||'none'}`);
 assert.ok(fixture.startsWith(root+path.sep));
 await mkdir(path.join(fixture,'unrelated-app'),{recursive:true});
 await writeFile(path.join(fixture,'unrelated-app','keep.txt'),'keep');
 for(const child of children){await mkdir(path.join(fixture,child,'Cache'),{recursive:true});await writeFile(path.join(fixture,child,'payday-key.json'),'FAKE TEST KEY');await writeFile(path.join(fixture,child,'payday-vault.json'),'FAKE TEST RECORDS');await writeFile(path.join(fixture,child,'Cache','test'),'cache');}
 const run=spawnSync(path.join(root,'cleanup-test.exe'),[`/CASE=${path.basename(fixture)}`],{encoding:'utf8',windowsHide:true});
 assert.equal(run.status,0,run.stderr);
 assert.equal(await readFile(path.join(fixture,'cleanup-result.txt'),'utf8'),'0');
 for(const child of ['Payday','payday-desktop']) await assert.rejects(access(path.join(fixture,child)));
 assert.equal(await readFile(path.join(fixture,'unrelated-app','keep.txt'),'utf8'),'keep');
 console.log(`PASS: ${children.join(', ')||'both absent'}; all Payday data removed, unrelated app preserved`);
}
console.log(`NSIS runtime verification fixtures: ${root}`);

