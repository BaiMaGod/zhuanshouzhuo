import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
import solutions from '../src/solutions.js';
const root=resolve(process.env.JADE_DIST||'dist'),out=resolve(process.env.JADE_REPORT||'tests/results/input');await mkdir(out,{recursive:true});
const server=createServer(async(q,r)=>{try{const path=resolve(root,'.'+(new URL(q.url,'http://a').pathname==='/'?'/index.html':new URL(q.url,'http://a').pathname));if(!path.startsWith(root+sep))throw Error();r.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.ls':'application/json','.woff':'font/woff','.wav':'audio/wav','.png':'image/png','.jpg':'image/jpeg'})[extname(path)]||'application/octet-stream');r.end(await readFile(path))}catch{r.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errors=[],profiles=[];
try{
 for(const [width,height] of [[360,640],[390,844]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true});
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
  await page.goto('http://127.0.0.1:'+server.address().port+'/?debug');
  await page.waitForFunction(()=>globalThis.jadeDebug?.game&&!document.querySelector('#boot')&&!document.querySelector('#splash'));
  await page.evaluate(()=>jadeDebug.game.home()); // Start formal smoke test on the homepage.
  const cdp=await page.context().newCDPSession(page);
  const click=async label=>{
   const p=await page.evaluate(label=>{const g=jadeDebug.game,walk=(n,x=0,y=0)=>{x+=n.x;y+=n.y;if(n.name===label||n.label?.text===label)return{x:x+n.width/2,y:y+n.height/2};for(let i=0;i<n.numChildren;i++){const p=walk(n.getChildAt(i),x,y);if(p)return p}};const p=walk(g.modalOpen?g.overlay:g.scene),r=document.querySelector('canvas').getBoundingClientRect();return{x:r.left+p.x/g.scene.width*r.width,y:r.top+p.y/g.scene.height*r.height}},label);
   await page.touchscreen.tap(p.x,p.y);await page.waitForTimeout(80);
  };
  await click('第1关');
  const before=await page.evaluate(()=>({zoom:jadeDebug.game.board.zoom,steps:jadeDebug.game.model.state.steps}));
  const center=await page.evaluate(()=>{const g=jadeDebug.game,r=document.querySelector('canvas').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+g.board.screen.y/g.scene.height*r.height}});
  const touch=(id,x,y)=>({id,x,y,radiusX:1,radiusY:1,force:1});
  const send=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  await send('touchStart',[touch(1,center.x-35,center.y),touch(2,center.x+35,center.y)]);
  for(let d=40;d<=65;d+=5)await send('touchMove',[touch(1,center.x-d,center.y),touch(2,center.x+d,center.y)]);
  await send('touchEnd',[]);
  assert.ok(await page.evaluate(()=>jadeDebug.game.board.zoom)>before.zoom);
  assert.equal(await page.evaluate(()=>jadeDebug.game.model.state.steps),before.steps);
  assert.equal(await page.evaluate(()=>jadeDebug.game.pointers.size),0);
  await click('全盘');
  // A real touchcancel must clear the drag without a phantom extra turn.
  const ringPoint=await page.evaluate(()=>{const {game:g,Core:C}=jadeDebug,r=g.model.state.rings[0],p=g.board.toScreen(C.point(r,r.a+50)),box=document.querySelector('canvas').getBoundingClientRect();return{x:box.left+p.x/g.scene.width*box.width,y:box.top+p.y/g.scene.height*box.height}});
  await send('touchStart',[touch(3,ringPoint.x,ringPoint.y)]);await send('touchCancel',[]);
  assert.equal(await page.evaluate(()=>jadeDebug.game.drag),null);
  assert.equal(await page.evaluate(()=>jadeDebug.game.pointers.size),0);
  async function complete(index,reloadHold=false){
   let reloaded=false;
   for(const action of solutions[index]){
   const activeBefore=await page.evaluate(()=>jadeDebug.game.model.state.rings.filter(r=>r.life==='active').length);
   const points=await page.evaluate(a=>{const {game:g,Core:C}=jadeDebug,r=C.ring(g.model.state,a.id),box=document.querySelector('canvas').getBoundingClientRect(),n=Math.ceil(Math.abs(a.delta)/3);return Array.from({length:n+1},(_,i)=>{const p=g.board.toScreen(C.point(r,r.a+50+a.delta*i/n));return{x:box.left+p.x/g.scene.width*box.width,y:box.top+p.y/g.scene.height*box.height}})},action);
   await send('touchStart',[touch(4,points[0].x,points[0].y)]);
   for(const p of points.slice(1))await send('touchMove',[touch(4,p.x,p.y)]);
   await send('touchEnd',[]);await page.waitForFunction(()=>!jadeDebug.game.board.animating);
   if(reloadHold&&!reloaded&&activeBefore===await page.evaluate(()=>jadeDebug.game.model.state.rings.filter(r=>r.life==='active').length)){
    const before=await page.evaluate(()=>JSON.stringify(jadeDebug.game.model.state));
    await page.reload();await page.waitForFunction(()=>globalThis.jadeDebug?.game&&!document.querySelector('#boot')&&!document.querySelector('#splash'));
    await page.evaluate(index=>jadeDebug.game.load(index),index);
    assert.equal(await page.evaluate(()=>JSON.stringify(jadeDebug.game.model.state)),before,'reload preserves a real held alignment');reloaded=true;
   }
   }
   await page.waitForFunction(()=>jadeDebug.game.model.cleared&&jadeDebug.game.settled);
   if(reloadHold)assert.ok(reloaded);
  }
  await complete(10);
  for(const index of [14,19]){
   await page.evaluate(index=>jadeDebug.game.load(index,true),index);
   await page.screenshot({path:resolve(out,width+'-level'+(index-9)+'-start.png')});
   await complete(index,index===19);
  }
  await page.evaluate(()=>{
   const g=jadeDebug.game;g.load(109,true);
   const original=g.hint.bind(g);g.hint=async()=>{const start=performance.now();await original();globalThis.measuredHintMs=performance.now()-start};
  });
  await click('提示 ×1');await page.waitForFunction(()=>globalThis.measuredHintMs!==undefined&&!!jadeDebug.game.guide?.action);
  const hintMs=await page.evaluate(()=>globalThis.measuredHintMs);assert.ok(hintMs<=200,'level100 hint exceeds 200ms: '+hintMs);
  await page.setViewportSize({width:height,height:width});await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>jadeDebug.game.pointers.size),0);
  await page.screenshot({path:resolve(out,width+'-level100-hint.png')});
  profiles.push({width,height,pinch:true,touchCancel:true,realTouchClear:[1,5,10],holdReload:true,level100HintMs:hintMs,resize:true});await page.close();
  console.log('Touch input passed:',width,height);
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'report.json'),JSON.stringify({errors,profiles},null,2));
}finally{await browser.close();server.close()}
