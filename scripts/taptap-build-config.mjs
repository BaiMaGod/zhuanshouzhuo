// Public values only: this file must never read a client secret or login code.
export function tapBuildConfig(env=process.env){
 const config={appId:'958691',levelsBoard:env.TAP_LEVELS_BOARD_ID??'8fhubriadufle2x7ic',starsBoard:env.TAP_STARS_BOARD_ID??'q1vw62hcu7xhx9dnwv',rewardedAdUnitId:env.TAP_REWARDED_AD_UNIT_ID??''};
 const release=env.TAP_RELEASE==='1';
 for(const [key,value] of Object.entries(config)){
  if(value&&!/^[A-Za-z0-9_-]+$/.test(value))throw Error('Invalid public TapTap config: '+key);
  if(release&&(!value||/^(?:__|your[-_]|example|test[-_]|mock[-_])/i.test(value)))throw Error('TapTap release requires real public config: '+key);
 }
 return {target:release?'taptap-h5':'web',...config};
}
