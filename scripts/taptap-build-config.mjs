// Public values only: this file must never read a client secret or login code.
import {readFileSync} from 'node:fs';
const defaults=JSON.parse(readFileSync(new URL('../config/taptap-public.json',import.meta.url),'utf8'));
export function tapBuildConfig(env=process.env){
 if(defaults.appId!=='958691'||defaults.adsVerification?.appId!==958691||defaults.adsVerification?.status!==1||defaults.screenOrientation!=='portrait'||defaults.adsVerification?.screenOrientation!==1)throw Error('TapTap public profile must match the verified portrait application');
 const config={appId:defaults.appId,screenOrientation:defaults.screenOrientation,levelsBoard:env.TAP_LEVELS_BOARD_ID??defaults.levelsBoard,starsBoard:env.TAP_STARS_BOARD_ID??defaults.starsBoard,rewardedAdUnitId:env.TAP_REWARDED_AD_UNIT_ID??defaults.rewardedAdUnitId};
 const release=env.TAP_RELEASE==='1';
 for(const [key,value] of Object.entries(config)){
  if(value&&!/^[A-Za-z0-9_-]+$/.test(value))throw Error('Invalid public TapTap config: '+key);
  if(release&&(!value||/^(?:__|your[-_]|example|test[-_]|mock[-_])/i.test(value)))throw Error('TapTap release requires real public config: '+key);
 }
 return {target:release?'taptap-h5':'web',...config};
}
