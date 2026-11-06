import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/cloud-restore-message.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source.replace('export function cloudRestoreMessage','function cloudRestoreMessage'),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}
}).outputText;
const cloudRestoreMessage=vm.runInNewContext(js+'\ncloudRestoreMessage');

test('cloud migration summary preserves the affected levels without rendering long backup paths',()=>{
 const backupPath='tapfile://usr/jade_recovery_2c399d09eed45d1b005c5d80cde5ada_3feda25fcc404fcdba74f798f6fe1';
 const message=cloudRestoreMessage('发现 1 局旧版未完成盘面与当前关卡不兼容（第13关）。已备份原始云档并隔离不兼容盘面；已通关成绩、星星、道具和其他有效盘面均保留。备份文件：'+backupPath);
 assert.match(message.lines[0],/第13关/);
 assert.match(message.lines.join(''),/已保留/);
 assert.equal(message.backupPath,backupPath);
 assert.equal(message.lines.join('').includes('tapfile://'),false);
});

test('migration warning without backup path still displays a readable summary',()=>{
 const message=cloudRestoreMessage('发现 2 局旧版未完成盘面与当前关卡不兼容（第10关、第11关）。');
 assert.match(message.lines[0],/第10关、第11关/);
 assert.equal(message.backupPath,'');
});
