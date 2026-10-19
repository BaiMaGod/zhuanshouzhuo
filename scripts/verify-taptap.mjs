import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {tapBuildConfig} from './taptap-build-config.mjs';
export function verifyTapPackage(root='dist'){
 const manifest=JSON.parse(readFileSync(resolve(root,'taptap-build.json'),'utf8'));
 if(manifest.target!=='taptap-h5')throw Error('Not a TapTap release build; use npm run release:taptap');
 const expected=tapBuildConfig({TAP_RELEASE:'1',TAP_LEVELS_BOARD_ID:manifest.levelsBoard,TAP_STARS_BOARD_ID:manifest.starsBoard,TAP_REWARDED_AD_UNIT_ID:manifest.rewardedAdUnitId});
 if(manifest.appId!==expected.appId)throw Error('Unexpected TapTap application ID');
 const config=readFileSync(resolve(root,'js/taptap-config.js'),'utf8');
 for(const key of ['appId','levelsBoard','starsBoard','rewardedAdUnitId']){
  const match=config.match(new RegExp(key+':\\s*([\'\"])(.*?)\\1'));
  if(!match||match[2]!==manifest[key])throw Error('Packaged config mismatch: '+key);
 }
 if(/__TAP_|loginUrl/.test(config))throw Error('Unresolved/legacy TapTap config in package');
 if(!existsSync(resolve(root,'index.html'))||!existsSync(resolve(root,'js/taptap.js')))throw Error('Incomplete H5 package');
 for(const path of ['server','tests','node_modules','.git'])if(existsSync(resolve(root,path)))throw Error('Unexpected source files in H5 package: '+path);
 return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const manifest=verifyTapPackage(process.argv[2]||'dist');console.log('TapTap H5 package config verified:',manifest.appId,manifest.version);
}
