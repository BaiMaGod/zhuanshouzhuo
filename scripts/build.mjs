import {spawnSync} from 'node:child_process';
import {levels,TEACHING_COUNT} from '../src/levels.js';
import {rmSync,mkdirSync,cpSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
rmSync('dist',{recursive:true,force:true});
mkdirSync('dist',{recursive:true});
const run=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project','tsconfig.json'],{stdio:'inherit'});
if(run.status!==0)process.exit(run.status||1);
cpSync('public','dist',{recursive:true});
// Only ship assets the current game loads. Historical originals stay in source control.
for(const name of readdirSync('dist/assets'))if(!['jade-v2','art-rose','art-v3','fonts','audio','shadow.png'].includes(name))rmSync('dist/assets/'+name,{recursive:true,force:true});
for(const name of readdirSync('dist/assets/art-v3'))if(name!=='clasp.png')rmSync('dist/assets/art-v3/'+name,{force:true});
for(const name of ['ceramic_drag_1','ceramic_place_1','friction'])rmSync('dist/assets/audio/'+name+'.wav',{force:true});
rmSync('dist/js/solver-worker.js',{force:true});
const p=JSON.parse(readFileSync('package.json','utf8'));
for(const file of readdirSync('dist/js').filter(f=>f.endsWith('.js'))){
 const path='dist/js/'+file;
 const text=readFileSync(path,'utf8')
  .replace(/(from\s+|import\s*)(['"])(\.\/[^'"]+\.js)\2/g,(_,prefix,q,url)=>prefix+q+url+'?v='+p.version+q);
 writeFileSync(path,text);
}
const html=readFileSync('dist/index.html','utf8').replace('src="js/main.js"','src="js/main.js?v='+p.version+'"');
writeFileSync('dist/index.html',html);
writeFileSync('dist/version.json',JSON.stringify({version:p.version,engine:'LayaAir 3.4.0',rules:'V3.2',levels:levels.length,teachingLevels:TEACHING_COUNT,formalLevels:levels.length-TEACHING_COUNT})+'\n');
console.log('Built 玉环十境 '+p.version);

