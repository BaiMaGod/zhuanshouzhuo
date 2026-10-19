// Real browser/WebGL with simulated TapTap APIs; not a real-account acceptance test.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {chromium} from 'playwright';
const dist=resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.woff':'font/woff','.mp3':'audio/mpeg','.wav':'audio/wav'};
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname,file=resolve(dist,path==='/'?'index.html':'.'+path);if(!file.startsWith(dist+sep)){res.writeHead(403).end();return}res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file))}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const url='http://127.0.0.1:'+server.address().port+'/?debug',errors=[];
const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
async function clickLabel(page,label){
 const point=await page.evaluate(label=>{const g=window.jadeDebug.game,card=g.modalCard;let button;for(let i=0;i<card.numChildren;i++){const child=card.getChildAt(i);if(child.label?.text===label)button=child}if(!button)throw Error('Missing '+label);const r=document.querySelector('canvas').getBoundingClientRect();return{x:r.left+(card.x+button.x+button.width/2)*r.width/720,y:r.top+(card.y+button.y+button.height/2)*r.height/g.scene.height}},label);
 await page.mouse.click(point.x,point.y);
}
try{
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.tap={login:()=>{},env:{USER_DATA_PATH:'tapfile://usr'},getCloudSaveManager:()=>({getArchiveList:o=>o.success({saves:[]}),createArchive:o=>o.success({uuid:'browser-slot',fileId:'file'}),updateArchive:o=>o.success({fileId:'file'})}),getFileSystemManager:()=>({writeFile:o=>o.success({})})}});
 await page.goto(url);await page.waitForFunction(()=>window.jadeDebug?.game.platform.ready);
 await page.evaluate(()=>{const g=window.jadeDebug.game;g.home();g.showPlatformCheck()});
 assert.equal(await page.evaluate(()=>window.jadeDebug.game.platform.states.login),'busy');
 assert.equal(await page.evaluate(()=>window.jadeDebug.game.platform.states.cloud),'ready');
 const layout=await page.evaluate(()=>{const g=window.jadeDebug.game,card=g.modalCard;let bottom=0;for(let i=0;i<card.numChildren;i++){const c=card.getChildAt(i);bottom=Math.max(bottom,c.y+c.height)}return{cardHeight:card.height,bottom}});
 assert.ok(layout.bottom<=layout.cardHeight,JSON.stringify(layout));
 await mkdir('tests/results',{recursive:true});await page.screenshot({path:'tests/results/taptap-connection-check.png'});
 await clickLabel(page,'复制诊断');
 await page.waitForFunction(async()=>{try{return (await navigator.clipboard.readText()).startsWith('{')}catch{return false}},{},{timeout:5000});
 const report=await page.evaluate(()=>navigator.clipboard.readText());assert.equal(JSON.parse(report).version,JSON.parse(await readFile(resolve('package.json'),'utf8')).version);
 assert.ok(report.includes('getArchiveList'));assert.ok(report.includes('invoke'));
 await mkdir('tests/results',{recursive:true});await page.screenshot({path:'tests/results/taptap-connection-check.png'});
 const slow=await context.newPage();slow.on('pageerror',e=>errors.push(e.message));
 await slow.addInitScript(()=>{window.tap={login:()=>{},env:{USER_DATA_PATH:'tapfile://usr'},getCloudSaveManager:()=>({getArchiveList:()=>{}}),getFileSystemManager:()=>({})}});
 await slow.goto(url);await slow.waitForFunction(()=>window.jadeDebug?.game);
 await slow.waitForFunction(()=>window.jadeDebug.game.modalOpen,{},{timeout:12000});
 await slow.screenshot({path:'tests/results/taptap-slow-recovery.png'});
 await clickLabel(slow,'继续本地游戏');await slow.waitForFunction(()=>window.jadeDebug.game.mode==='game');
 assert.equal(await slow.evaluate(()=>window.jadeDebug.game.platform.ready),false);
 const broken=await context.newPage();broken.on('pageerror',e=>errors.push(e.message));
 await broken.addInitScript(()=>{window.tap={login:()=>{throw new TypeError('H5 native bridge unavailable')},env:{USER_DATA_PATH:'tapfile://usr'},getCloudSaveManager:()=>({getArchiveList:o=>o.success({saves:[]}),createArchive:o=>o.success({uuid:'browser-slot',fileId:'file'}),updateArchive:o=>o.success({fileId:'file'})}),getFileSystemManager:()=>({writeFile:o=>o.success({})})}});
 await broken.goto(url);await broken.waitForFunction(()=>window.jadeDebug?.game.platform.ready);
 assert.equal(await broken.evaluate(()=>window.jadeDebug.game.platform.states.login),'error');
 assert.ok(await broken.evaluate(()=>window.jadeDebug.game.platform.trace.events.some(e=>e.phase==='throw')));
 assert.deepEqual(errors,[]);console.log('WebGL mock bridge: no-callback login, diagnostic layout/copy, 8s local continuation and synchronous native error passed');
}finally{await browser.close();await new Promise(r=>server.close(r))}
