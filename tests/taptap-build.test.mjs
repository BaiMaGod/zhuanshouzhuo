import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {tapBuildConfig} from '../scripts/taptap-build-config.mjs';
import {verifyTapPackage} from '../scripts/verify-taptap.mjs';
test('TapTap release requires public config, without requiring a login server',()=>{
 assert.equal(tapBuildConfig({}).target,'web');
 assert.throws(()=>tapBuildConfig({TAP_RELEASE:'1'}),/rewardedAdUnitId/);
 assert.throws(()=>tapBuildConfig({TAP_RELEASE:'1',TAP_REWARDED_AD_UNIT_ID:'your-ad-unit-id'}));
 const config=tapBuildConfig({TAP_RELEASE:'1',TAP_REWARDED_AD_UNIT_ID:'verified-platform-id'});
 assert.equal(config.target,'taptap-h5');assert.equal(config.appId,'958691');assert.equal('loginUrl' in config,false);
});
test('final artifact check rejects ordinary web builds and mismatched embedded config',()=>{
 const root=mkdtempSync(join(tmpdir(),'jade-tap-build-'));
 try{
  mkdirSync(join(root,'js'));writeFileSync(join(root,'index.html'),'');writeFileSync(join(root,'js/taptap.js'),'');
  writeFileSync(join(root,'taptap-build.json'),JSON.stringify(tapBuildConfig({})));
  assert.throws(()=>verifyTapPackage(root),/Not a TapTap release/);
  const config=tapBuildConfig({TAP_RELEASE:'1',TAP_REWARDED_AD_UNIT_ID:'verified-platform-id'});
  writeFileSync(join(root,'taptap-build.json'),JSON.stringify(config));
  writeFileSync(join(root,'js/taptap-config.js'),'export const TAP_CONFIG='+JSON.stringify(config));
  assert.throws(()=>verifyTapPackage(root),/mismatch/); // Quoted keys are not the generated TypeScript format.
  writeFileSync(join(root,'js/taptap-config.js'),"export const TAP_CONFIG = {appId:'958691', levelsBoard:'8fhubriadufle2x7ic', starsBoard:'q1vw62hcu7xhx9dnwv', rewardedAdUnitId:'wrong'};");
  assert.throws(()=>verifyTapPackage(root),/rewardedAdUnitId/);
  writeFileSync(join(root,'js/taptap-config.js'),"export const TAP_CONFIG = {appId:'958691', levelsBoard:'8fhubriadufle2x7ic', starsBoard:'q1vw62hcu7xhx9dnwv', rewardedAdUnitId:'verified-platform-id'};");
  assert.equal(verifyTapPackage(root).target,'taptap-h5');
 }finally{rmSync(root,{recursive:true,force:true})}
});
