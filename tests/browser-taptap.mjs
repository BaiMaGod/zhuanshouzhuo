// Local WebGL integration test. The injected tap implementation is a test double,
// not proof of real TapTap authentication, ad inventory or cloud behavior.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {chromium} from 'playwright';
const dist=resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.woff':'font/woff','.mp3':'audio/mpeg','.wav':'audio/wav'};
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=pathname==='/'?resolve(dist,'index.html'):resolve(dist,'.'+pathname);if(!file.startsWith(dist+sep)){res.writeHead(403).end();return}res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file))}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const files=new Map(),slots=[];let close,fail;
  window.testTap={complete:ended=>close?.({isEnded:ended}),shown:0};
  window.tap={env:{USER_DATA_PATH:'tapfile://usr'},login:o=>o.success({code:'mock-once'}),request:()=>{throw Error('H5 must not call a login server')},
   getFileSystemManager:()=>({writeFile:o=>{files.set(o.filePath,o.data);o.success({})},readFile:o=>o.success({data:files.get(o.filePath)})}),
   getCloudSaveManager:()=>({getArchiveList:o=>o.success({saves:slots}),createArchive:o=>{slots.push({name:'jade_save_v1',uuid:'mock',fileId:'mock'});o.success({uuid:'mock',fileId:'mock'})},updateArchive:o=>o.success({uuid:'mock',fileId:'mock'})}),
   getLeaderboardManager:()=>({submitScores:o=>o.callback.onSuccess({}),openLeaderboard:o=>o.callback.onSuccess({})}),
   createRewardedVideoAd:()=>({load:async()=>{},show:async()=>{window.testTap.shown++},onClose:f=>{close=f},onError:f=>{fail=f},offClose:()=>{close=null},offError:()=>{fail=null}})};
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/?debug');
 await page.waitForFunction(()=>window.jadeDebug?.game.platform.ready);
 assert.match(await page.evaluate(()=>window.jadeDebug.game.save.owner),/^(session:|archive:mock$)/);
 // The Web build intentionally contains no production ad ID. Inject an explicit
 // test-only value into this mock runtime, never into a release artifact.
 assert.equal(await page.evaluate(()=>window.jadeDebug.game.platform.adsAvailable),false);
 await page.evaluate(()=>{window.jadeDebug.game.platform.config.rewardedAdUnitId='mock-only'});
 await page.evaluate(()=>window.jadeDebug.game.tapMenu());
 await mkdir('tests/results',{recursive:true});await page.screenshot({path:'tests/results/taptap-menu.png'});
 await page.evaluate(()=>{const g=window.jadeDebug.game;g.hideModal();g.load(10,true)});
 const clickHint=async()=>{const p=await page.evaluate(()=>{const g=window.jadeDebug.game,b=g.hintButton,r=document.querySelector('canvas').getBoundingClientRect();return{x:r.left+(b.x+b.width/2)*r.width/720,y:r.top+(b.y+b.height/2)*r.height/g.scene.height}});await page.mouse.click(p.x,p.y)};
 await clickHint();await page.waitForFunction(()=>!window.jadeDebug.game.busy);
 assert.equal(await page.evaluate(()=>window.jadeDebug.game.toolLeft('hint')),0);
 await clickHint();await page.waitForFunction(()=>window.jadeDebug.game.modalOpen);
 await page.screenshot({path:'tests/results/taptap-reward-offer.png'});
 // Click the visible modal's primary watch button, exercising Laya dispatch.
 const watch=await page.evaluate(()=>{const g=window.jadeDebug.game,b=g.modalCard.getChildAt(g.modalCard.numChildren-2),r=document.querySelector('canvas').getBoundingClientRect();return{x:r.left+(g.modalCard.x+b.x+b.width/2)*r.width/720,y:r.top+(g.modalCard.y+b.y+b.height/2)*r.height/g.scene.height}});
 await page.mouse.click(watch.x,watch.y);await page.waitForFunction(()=>window.testTap.shown===1);
 await page.evaluate(()=>window.testTap.complete(true));await page.waitForFunction(()=>!window.jadeDebug.game.platform.adBusy);
 assert.equal(await page.evaluate(()=>window.jadeDebug.game.toolLeft('hint')),1);
 await clickHint();await page.waitForFunction(()=>!window.jadeDebug.game.busy);
 assert.equal(await page.evaluate(()=>window.jadeDebug.game.toolLeft('hint')),0);
 await page.evaluate(()=>window.jadeDebug.game.load(10,true));
 assert.equal(await page.evaluate(()=>window.jadeDebug.game.save.canClaim(10,'hint')),true);
 const local=await browser.newPage({viewport:{width:390,height:844}});
 await local.goto('http://127.0.0.1:'+server.address().port+'/?debug');
 await local.waitForFunction(()=>window.jadeDebug?.game);
 assert.deepEqual(await local.evaluate(()=>{const p=window.jadeDebug.game.platform;return [p.available,p.adsAvailable,p.boardAvailable()]}),[false,false,false]);
 await local.close();
 assert.deepEqual(errors,[]);console.log('Local WebGL with mock TapTap: login UI, reward modal, actual button clicks, grant/use/restart passed');
}finally{await browser.close();await new Promise(r=>server.close(r))}
