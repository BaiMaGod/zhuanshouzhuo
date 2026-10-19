import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {tapBuildConfig} from '../scripts/taptap-build-config.mjs';
import {verifyTapPackage} from '../scripts/verify-taptap.mjs';
import {packageTapBuild} from '../scripts/package-taptap.mjs';
test('TapTap release requires public config, without requiring a login server',()=>{
 assert.equal(tapBuildConfig({}).target,'web');
 assert.throws(()=>tapBuildConfig({TAP_RELEASE:'1',TAP_REWARDED_AD_UNIT_ID:''}),/rewardedAdUnitId/);
 assert.throws(()=>tapBuildConfig({TAP_RELEASE:'1',TAP_REWARDED_AD_UNIT_ID:'your-ad-unit-id'}));
 const config=tapBuildConfig({TAP_RELEASE:'1',TAP_REWARDED_AD_UNIT_ID:'verified-platform-id'});
 assert.equal(config.target,'taptap-h5');assert.equal(config.appId,'958691');assert.equal('loginUrl' in config,false);
});
test('default builds retain the officially resolved portrait ad config without environment variables',()=>{
 const profile=JSON.parse(readFileSync(new URL('../config/taptap-public.json',import.meta.url),'utf8'));
 assert.equal(profile.adsVerification.status,1);assert.equal(profile.adsVerification.appId,958691);
 assert.equal(profile.adsVerification.screenOrientation,1);
 for(const env of [{},{TAP_RELEASE:'1'}]){
  const config=tapBuildConfig(env);
  assert.equal(config.rewardedAdUnitId,profile.rewardedAdUnitId);
  assert.equal(config.rewardedAdUnitId,'1054324');
  assert.equal(config.screenOrientation,'portrait');
 }
});
test('TapTap ZIP refuses Web/mismatched builds and contains the verified production config',()=>{
 const root=mkdtempSync(join(tmpdir(),'jade-tap-zip-'));
 const dist=join(root,'dist'),output=join(root,'game.zip');
 try{
  mkdirSync(join(dist,'js'),{recursive:true});
  writeFileSync(join(dist,'index.html'),'<title>Game</title>');writeFileSync(join(dist,'js/taptap.js'),'');
  writeFileSync(join(dist,'taptap-build.json'),JSON.stringify({...tapBuildConfig({}),version:'0.15.1'}));
  assert.throws(()=>packageTapBuild(dist,output),/Not a TapTap release/);
  assert.equal(existsSync(output),false);
  const config={...tapBuildConfig({TAP_RELEASE:'1',TAP_REWARDED_AD_UNIT_ID:'verified-platform-id'}),version:'0.15.1'};
  writeFileSync(join(dist,'taptap-build.json'),JSON.stringify(config));
  writeFileSync(join(dist,'js/taptap-config.js'),"export const TAP_CONFIG = {appId:'958691', levelsBoard:'8fhubriadufle2x7ic', starsBoard:'q1vw62hcu7xhx9dnwv', rewardedAdUnitId:'wrong'};");
  assert.throws(()=>packageTapBuild(dist,output),/rewardedAdUnitId/);
  assert.equal(existsSync(output),false);
  writeFileSync(join(dist,'js/taptap-config.js'),"export const TAP_CONFIG = {appId:'958691', levelsBoard:'8fhubriadufle2x7ic', starsBoard:'q1vw62hcu7xhx9dnwv', rewardedAdUnitId:'verified-platform-id'};");
  const result=packageTapBuild(dist,output);
  assert.equal(result.appId,'958691');assert.match(result.sha256,/^[a-f0-9]{64}$/);
  const contents=spawnSync('python3',['-c',"import zipfile,sys,json; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({'files':z.namelist(),'manifest':json.loads(z.read('zhuanshouzhuo/taptap-build.json')),'entry':z.read('zhuanshouzhuo/index.html').decode()}))",output],{encoding:'utf8'});
  assert.equal(contents.status,0,contents.stderr);
  const actual=JSON.parse(contents.stdout);
  assert.equal(actual.entry,'<title>Game</title>');assert.deepEqual(actual.manifest,config);
  assert.ok(actual.files.every(name=>name.startsWith('zhuanshouzhuo/')));
  const previous=readFileSync(output);
  writeFileSync(join(dist,'taptap-build.json'),JSON.stringify({...config,target:'web'}));
  assert.throws(()=>packageTapBuild(dist,output),/Not a TapTap release/);
  assert.deepEqual(readFileSync(output),previous);
  assert.equal(existsSync(output+'.tmp'),false);
 }finally{rmSync(root,{recursive:true,force:true})}
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
  writeFileSync(join(root,'taptap-build.json'),JSON.stringify({...config,screenOrientation:'landscape'}));
  assert.throws(()=>verifyTapPackage(root),/screen orientation/);
 }finally{rmSync(root,{recursive:true,force:true})}
});
