import {spawnSync} from 'node:child_process';
import {rmSync,existsSync,readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const target=process.argv[2]||'web';
if(!['web','wxgame','bytedancegame','android','ios'].includes(target))throw Error('Unsupported target '+target);
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1)};
run(process.execPath,['scripts/build.mjs']);run(process.execPath,['scripts/prepare-laya.mjs']);
const output=resolve('.release-out',target);
rmSync(output,{recursive:true,force:true});
const built=spawnSync(process.env.LAYAAIR_CLI||'layaair',['--version=3.4.0','build',target,'-p',resolve('laya'),'-o',output],{encoding:'utf8',maxBuffer:16*1024*1024});
process.stdout.write(built.stdout||'');process.stderr.write(built.stderr||'');
if(built.status!==0||!/Build end, result=Success/.test(built.stdout||''))throw Error('Official '+target+' build failed; no verified artifact was produced');
if(!existsSync(output))throw Error('Official output missing');
const entry=target==='web'?'index.html':target==='wxgame'||target==='bytedancegame'?'game.js':null;
if(entry&&!existsSync(output+'/'+entry))throw Error('Missing platform entry');
for(const p of ['assets/jade-v2/amber.png','assets/art-rose/tray.png','assets/art-v3/clasp.png','assets/fonts/jade-text.woff','assets/audio/ratchet_tick.wav','assets/audio/win.wav']){
 // Native exporters may put Web resources in a nested package; require an explicit check before claiming verification.
 if(entry&&!existsSync(output+'/'+p))throw Error('Missing runtime asset: '+p);
}
if(target==='wxgame'||target==='bytedancegame'){
 const config=JSON.parse(readFileSync(output+'/game.json'));
 const roots=(config.subpackages||config.subPackages||[]).map(p=>p.root.replace(/\/$/,''));
 if(!roots.includes('assets'))throw Error('Required assets subpackage missing');
 let mainBytes=0;
 const sum=dir=>{for(const name of readdirSync(dir)){const p=dir+'/'+name,rel=relative(output,p);if(roots.some(root=>rel===root||rel.startsWith(root+'/')))continue;if(statSync(p).isDirectory())sum(p);else mainBytes+=statSync(p).size}};
 sum(output);if(mainBytes>4*1024*1024)throw Error('Mini-game main package exceeds 4 MiB');
 console.log('Main package:',mainBytes,'bytes; assets loaded by official engine subpackage loader');
}
const files={};let bytes=0;
function walk(dir){for(const n of readdirSync(dir)){const path=dir+'/'+n;if(statSync(path).isDirectory())walk(path);else{const b=readFileSync(path);bytes+=b.length;files[relative(output,path)]=createHash('sha256').update(b).digest('hex')}}}
walk(output);
writeFileSync(output+'/_build-evidence.json',JSON.stringify({target,engine:'LayaAir 3.4.0',version:JSON.parse(readFileSync('package.json')).version,exportPassed:true,browserSmokePassed:false,deviceSmokePassed:false,bytes,files},null,2));
console.log('Official export verified:',target,bytes,'bytes. Runtime/device validation is separate.');
