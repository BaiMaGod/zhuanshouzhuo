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
  const files=new Map(),slots=[];let close,fail,share;
  window.testTap={complete:ended=>close?.({isEnded:ended}),completeShare:()=>share?.success({channel:'wechat'}),shown:0,sharePanels:0};
  window.tap={onShareMessage:o=>{share=o},offShareMessage:()=>{share=null},showShareboard:o=>{window.testTap.sharePanels++;o.success({})},env:{USER_DATA_PATH:'tapfile://usr'},login:o=>o.success({code:'mock-once'}),request:()=>{throw Error('H5 must not call a login server')},
   getFileSystemManager:()=>({writeFile:o=>{files.set(o.filePath,o.data);o.success({})},readFile:o=>o.success({data:files.get(o.filePath)})}),
   getCloudSaveManager:()=>({getArchiveList:o=>o.success({saves:slots}),createArchive:o=>{slots.push({name:'jade_save_v1',uuid:'mock',fileId:'mock'});o.success({uuid:'mock',fileId:'mock'})},updateArchive:o=>o.success({uuid:'mock',fileId:'mock'})}),
   getLeaderboardManager:()=>({submitScores:o=>o.callback.onSuccess({}),openLeaderboard:o=>o.callback.onSuccess({})}),
   createRewardedVideoAd:options=>{window.testTap.adUnitId=options.adUnitId;return{load:async()=>{},show:async()=>{window.testTap.shown++},onClose:f=>{close=f},onError:f=>{fail=f},offClose:()=>{close=null},offError:()=>{fail=null}}}};
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/?debug');
 await page.waitForFunction(()=>window.jadeDebug?.game.platform.ready);
 assert.match(await page.evaluate(()=>window.jadeDebug.game.save.owner),/^(session:|archive:mock$)/);
 // Use the actual compiled configuration with a mock SDK. This verifies wiring,
 // without requesting real ad inventory from an ordinary browser.
 const packaged=JSON.parse(await readFile(resolve(dist,'taptap-build.json'),'utf8'));
 assert.equal(await page.evaluate(()=>window.jadeDebug.game.platform.adsAvailable),true);
 await page.evaluate(()=>window.jadeDebug.game.tapMenu());
 await mkdir('tests/results',{recursive:true});await page.screenshot({path:'tests/results/taptap-menu.png'});
 await page.evaluate(()=>{const g=window.jadeDebug.game;g.hideModal();g.load(10,true)});
 const clickHint=async()=>{const p=await page.evaluate(()=>{const g=window.jadeDebug.game,b=g.hintButton,r=document.querySelector('canvas').getBoundingClientRect();return{x:r.left+(b.x+b.width/2)*r.width/720,y:r.top+(b.y+b.height/2)*r.height/g.scene.height}});await page.mouse.click(p.x,p.y)};
 await clickHint();await page.waitForFunction(()=>!window.jadeDebug.game.busy);
 assert.equal(await page.evaluate(()=>window.jadeDebug.game.toolLeft('hint')),0);
 await clickHint();await page.waitForFunction(()=>window.jadeDebug.game.modalOpen);
 await page.screenshot({path:'tests/results/taptap-reward-offer.png'});
 // Click the visible modal's primary watch button, exercising Laya dispatch.
 const watch=await page.evaluate(()=>{const g=window.jadeDebug.game,b=Array.from({length:g.modalCard.numChildren},(_,i)=>g.modalCard.getChildAt(i)).find(c=>c.label?.text==='看视频得提示'),r=document.querySelector('canvas').getBoundingClientRect();return{x:r.left+(g.modalCard.x+b.x+b.width/2)*r.width/720,y:r.top+(g.modalCard.y+b.y+b.height/2)*r.height/g.scene.height}});
 await page.mouse.click(watch.x,watch.y);await page.waitForFunction(()=>window.testTap.shown===1);
 assert.equal(await page.evaluate(()=>window.testTap.adUnitId),packaged.rewardedAdUnitId);
 await page.evaluate(()=>window.testTap.complete(true));await page.waitForFunction(()=>!window.jadeDebug.game.platform.adBusy);
 assert.equal(await page.evaluate(()=>window.jadeDebug.game.toolLeft('hint')),1);
 await clickHint();await page.waitForFunction(()=>!window.jadeDebug.game.busy);
 assert.equal(await page.evaluate(()=>window.jadeDebug.game.toolLeft('hint')),0);
 await page.evaluate(()=>window.jadeDebug.game.load(10,true));
 assert.equal(await page.evaluate(()=>window.jadeDebug.game.save.canClaim(10,'hint')),true);
 // Configure a test template only in the mock browser. Production stays unset.
 await page.evaluate(()=>{const g=window.jadeDebug.game;g.platform.config.shareTemplateId='approved-test-template';g.load(10,true);g.toggleErase()});
 assert.equal(await page.evaluate(()=>window.jadeDebug.game.toolLeft('erase')),0);
 const sharePoint=await page.evaluate(()=>{const g=window.jadeDebug.game;let b;for(let i=0;i<g.modalCard.numChildren;i++){const c=g.modalCard.getChildAt(i);if(c.label?.text==='分享得消除')b=c}const r=document.querySelector('canvas').getBoundingClientRect();return{x:r.left+(g.modalCard.x+b.x+b.width/2)*r.width/720,y:r.top+(g.modalCard.y+b.y+b.height/2)*r.height/g.scene.height}});
 await page.mouse.click(sharePoint.x,sharePoint.y);await page.waitForFunction(()=>window.testTap.sharePanels===1);
 assert.equal(await page.evaluate(()=>window.jadeDebug.game.toolLeft('erase')),0,'panel alone must not reward');
 await page.evaluate(()=>window.testTap.completeShare());await page.waitForFunction(()=>!window.jadeDebug.game.platform.shareBusy);
 assert.equal(await page.evaluate(()=>window.jadeDebug.game.toolLeft('erase')),1);
 await page.evaluate(()=>window.jadeDebug.game.toggleErase());
 await page.waitForFunction(()=>window.jadeDebug.game.toolNoticeBox.visible);
 await page.screenshot({path:'tests/results/taptap-erase-notice.png'});
 assert.ok(await page.evaluate(()=>{const g=window.jadeDebug.game;return g.toolNoticeBox.y+g.toolNoticeBox.height<g.eraseButton.y-100&&g.eraseTip.fontSize===30}));
 await page.evaluate(()=>{const g=window.jadeDebug.game;g.toggleErase();g.save.consumeReward(10,'erase');g.syncTools();g.offerReward('erase')});
 assert.equal(await page.evaluate(()=>{const card=window.jadeDebug.game.modalCard;for(let i=0;i<card.numChildren;i++){const c=card.getChildAt(i);if(c.label?.text==='分享奖励已领取')return c.enabled}return true}),false);
 const local=await browser.newPage({viewport:{width:390,height:844}});
 await local.goto('http://127.0.0.1:'+server.address().port+'/?debug');
 await local.waitForFunction(()=>window.jadeDebug?.game);
 assert.deepEqual(await local.evaluate(()=>{const p=window.jadeDebug.game.platform;return [p.available,p.adsAvailable,p.boardAvailable()]}),[false,false,false]);
 await local.close();
 assert.deepEqual(errors,[]);console.log('Local WebGL with mock TapTap: leaderboard, video/share modal clicks, share-success grant, elevated notice and restart passed');
}finally{await browser.close();await new Promise(r=>server.close(r))}
