import {spawnSync} from 'node:child_process';
// This command prepares a Web/H5 directory; it does not publish or submit review.
const result=spawnSync(process.execPath,['scripts/build.mjs'],{stdio:'inherit',env:{...process.env,TAP_RELEASE:'1'}});
if(result.status!==0)process.exit(result.status??1);
const check=spawnSync(process.execPath,['scripts/verify-taptap.mjs'],{stdio:'inherit'});
process.exit(check.status??1);
