import {spawnSync} from 'node:child_process';
import {rmSync,mkdirSync,cpSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
rmSync('dist',{recursive:true,force:true});
mkdirSync('dist',{recursive:true});
const run=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project','tsconfig.json'],{stdio:'inherit'});
if(run.status!==0)process.exit(run.status||1);
cpSync('public','dist',{recursive:true});
const p=JSON.parse(readFileSync('package.json','utf8'));
for(const file of readdirSync('dist/js').filter(f=>f.endsWith('.js'))){
 const path='dist/js/'+file;
 const text=readFileSync(path,'utf8')
  .replace(/(from\s+|import\s*)(['"])(\.\/[^'"]+\.js)\2/g,(_,prefix,q,url)=>prefix+q+url+'?v='+p.version+q)
  .replace(/new URL\((['"])(\.\/solver-worker\.js)\1/g,(_,q,url)=>'new URL('+q+url+'?v='+p.version+q);
 writeFileSync(path,text);
}
const html=readFileSync('dist/index.html','utf8').replace('src="js/main.js"','src="js/main.js?v='+p.version+'"');
writeFileSync('dist/index.html',html);
writeFileSync('dist/version.json',JSON.stringify({version:p.version,engine:'LayaAir 3.4.0',rules:'V3.2',levels:10})+'\n');
console.log('Built 玉环十境 '+p.version);
