// Real input regression for the approved feature artwork and live reward UI.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
const root=resolve(process.env.JADE_DIST||'dist'),out=resolve(process.env.JADE_REPORT||'tests/results/feature-ui');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const name=new URL(req.url,'http://local').pathname,file=resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(root+sep))throw Error('path');
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff':'font/woff','.wav':'audio/wav','.mp3':'audio/mpeg'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const report={errors:[],profiles:[],artifacts:{}};
for(const name of ['js/bundle.js','js/main.js','js/feature-art.js','assets/art-rose/signin-panel.webp','assets/art-rose/bag-panel.webp','assets/art-rose/signin-shortcut.webp','assets/art-rose/bag-shortcut.webp','assets/fonts/jade-song.woff','assets/fonts/jade-text.woff'])if(existsSync(resolve(root,name)))report.artifacts[name]=createHash('sha256').update(await readFile(resolve(root,name))).digest('hex');
try{
 for(const [width,height] of [[360,640],[390,844],[360,600],[1280,720]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:2,hasTouch:true,isMobile:width<600,reducedMotion:'reduce'});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url())});page.on('requestfailed',r=>report.errors.push(r.url()));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?debug');
  await page.waitForFunction(()=>!!window.jadeDebug?.game&&!document.querySelector('#boot')&&!document.querySelector('#splash'));
  const click=async name=>{
   const p=await page.evaluate(name=>{
    const g=window.jadeDebug.game;
    const walk=(n,x=0,y=0,s=1)=>{if(n.visible===false)return null;x+=n.x*s;y+=n.y*s;s*=n.scaleX;if(n.name===name||n.label?.text===name)return{x:x+n.width*s/2,y:y+n.height*s/2};for(let i=0;i<n.numChildren;i++){const p=walk(n.getChildAt(i),x,y,s);if(p)return p}return null};
    const p=walk(g.modalOpen?g.overlay:g.scene);if(!p)throw Error('Missing '+name);const box=document.querySelector('canvas').getBoundingClientRect();return{x:box.left+p.x/g.scene.width*box.width,y:box.top+p.y/g.scene.height*box.height};
   },name);await page.touchscreen.tap(p.x,p.y);await page.waitForTimeout(200);
  };
  if(await page.evaluate(()=>jadeDebug.game.mode)==='game')await click('button:home');
  assert.equal(await page.evaluate(()=>jadeDebug.game.mode),'home');
  const shot=async name=>{const file=width+'x'+height+'-'+name+'.png';await page.screenshot({path:resolve(out,file)});return file};
  const home=await shot('home');
  await click('button:bag');
  assert.equal(await page.evaluate(()=>jadeDebug.game.modalCard.getChildAt(0).text),'我的背包');
  const bounds=await page.evaluate(()=>{const c=jadeDebug.game.modalCard,g=jadeDebug.game;return{inside:c.y>=0&&c.y+c.height*c.scaleY<=g.scene.height,counts:Array.from({length:c.numChildren},(_,i)=>c.getChildAt(i)).filter(n=>n.name.startsWith('inventory-item:')).map(n=>Array.from({length:n.numChildren},(_,i)=>n.getChildAt(i)).find(n=>n.name.startsWith('inventory-count:')).text)}});
  assert.ok(bounds.inside);assert.deepEqual(bounds.counts,['拥有 ×0','拥有 ×0']);
  const empty=await shot('bag-empty');await click('button:close-bag');
  await click('button:signin');
  const day7=await page.evaluate(()=>{const c=jadeDebug.game.modalCard,d=c.getChildByName('signin-day:7'),labels=Array.from({length:d.numChildren},(_,i)=>d.getChildAt(i)).filter(n=>n.name.startsWith('signin-reward-label:'));return{inside:c.y>=0&&c.y+c.height*c.scaleY<=jadeDebug.game.scene.height,separated:labels[0].x+labels[0].width<labels[1].x,text:labels.map(n=>n.text)}});
  assert.ok(day7.inside&&day7.separated);assert.deepEqual(day7.text,['提示×1','消除×1']);
  const sign=await shot('signin');await click('button:claim-signin');
  assert.equal(await page.evaluate(()=>jadeDebug.game.save.inventoryLeft('hint')),1);
  assert.equal(await page.evaluate(()=>jadeDebug.game.save.dailySignInStatus().claimedToday),true);
  assert.equal(await page.evaluate(()=>jadeDebug.game.modalCard.getChildByName('button:claim-signin').enabled),false);
  await click('button:claim-signin');assert.equal(await page.evaluate(()=>jadeDebug.game.save.inventoryLeft('hint')),1,'disabled button cannot double grant');
  const claimed=await shot('signin-claimed');await click('button:close-feature');
  await click('button:bag');
  assert.equal(await page.evaluate(()=>jadeDebug.game.modalCard.getChildByName('inventory-item:hint').getChildByName('inventory-count:hint').text),'拥有 ×1');
  const bag=await shot('bag');await click('button:close-feature');
  for(let n=0;n<3;n++){await click('button:signin');await click('button:close-feature');await click('button:bag');await click('button:close-bag')}
  await page.reload();await page.waitForFunction(()=>!!window.jadeDebug?.game&&!document.querySelector('#boot')&&!document.querySelector('#splash'));
  assert.equal(await page.evaluate(()=>jadeDebug.game.save.inventoryLeft('hint')),1);
  await click('button:signin');assert.equal(await page.evaluate(()=>jadeDebug.game.modalCard.getChildByName('button:claim-signin').enabled),false);await click('button:close-feature');
  report.profiles.push({width,height,input:'real touchscreen tap',singleGrant:true,persisted:true,day7Separated:true,modalInBounds:true,screenshots:{home,empty,sign,claimed,bag}});await page.close();
  console.log('Feature UI passed',width,height);
 }
 assert.deepEqual(report.errors,[]);
}finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await browser.close();server.close()}
