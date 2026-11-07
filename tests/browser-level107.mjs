import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {chromium} from 'playwright';
import {buildLevel107Sample} from '../src/level107-sample.js';

const dist=resolve(process.env.JADE_DIST||'dist');
const out=resolve(process.env.JADE_REPORT||'tests/results/level107-browser');
await mkdir(out,{recursive:true});
const {route}=buildLevel107Sample();
const mime={
 '.html':'text/html','.js':'text/javascript','.json':'application/json',
 '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
 '.woff':'font/woff','.woff2':'font/woff2','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg'
};
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url||'/', 'http://localhost').pathname;
  const file=resolve(dist,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));
  if(file!==dist&&!file.startsWith(dist+sep))throw Error('path');
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
  res.end(await readFile(file));
 }catch{res.writeHead(404).end('Not found')}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const report={errors:[],routeSteps:route.length,viewport:{width:390,height:844}};
try{
 const page=await browser.newPage({viewport:report.viewport,deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push('pageerror: '+e.message));
 page.on('requestfailed',r=>report.errors.push('requestfailed: '+r.url()));
 page.on('response',r=>{if(r.status()>=400)report.errors.push('http '+r.status()+': '+r.url())});
 await page.goto('http://127.0.0.1:'+server.address().port+'/?debug=1&sample107=1');
 await page.waitForFunction(()=>window.jadeDebug?.game?.sampleLevelIndex!==null&&window.jadeDebug.game.model?.index===window.jadeDebug.game.sampleLevelIndex,{timeout:60000});
 const initial=await page.evaluate(()=>{
  const g=window.jadeDebug.game;
  const title=[];
  const walk=n=>{if(n.text)title.push(n.text);for(let i=0;i<n.numChildren;i++)walk(n.getChildAt(i))};
  walk(g.scene);
  return{index:g.model.index,sampleIndex:g.sampleLevelIndex,ringCount:g.model.state.rings.length,
   activeRings:g.model.state.rings.filter(r=>r.life==='active').length,
   mounted:g.model.state.rods.filter(r=>r.kind==='m').length,
   background:g.model.state.rods.filter(r=>r.kind==='b').length,
   errors:g.Core.validate(g.model.state),title:title.find(t=>t.includes('第107关'))||null};
 });
 assert.equal(initial.index,110,'sample must stay outside the 100 official levels');
 assert.equal(initial.sampleIndex,110);
 assert.equal(initial.ringCount,109);
 assert.equal(initial.activeRings,109);
 assert.equal(initial.mounted,125);
 assert.equal(initial.background,14);
 assert.deepEqual(initial.errors,[]);
 assert.equal(initial.title,'第107关 · 样板');
 await page.screenshot({path:resolve(out,'level107-initial-mobile.png')});

 async function drag(action){
  const points=await page.evaluate(action=>{
   const {game:g,Core:C}=window.jadeDebug,ring=C.ring(g.model.state,action.id);
   if(!ring||ring.life!=='active')throw Error('route ring is not active: '+action.id);
   const start=ring.a+50,box=document.querySelector('canvas').getBoundingClientRect(),n=Math.max(1,Math.ceil(Math.abs(action.delta)/3));
   return Array.from({length:n+1},(_,i)=>{
    const p=g.board.toScreen(C.point(ring,start+action.delta*i/n));
    return{x:box.left+p.x/g.scene.width*box.width,y:box.top+p.y/g.scene.height*box.height};
   });
  },action);
  await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();
  for(const p of points.slice(1))await page.mouse.move(p.x,p.y);
  await page.mouse.up();
  await page.waitForFunction(()=>!window.jadeDebug.game.board.animating,{timeout:10000});
 }
 for(let i=0;i<route.length;i++){
  await drag(route[i]);
  const state=await page.evaluate(()=>({
   active:window.jadeDebug.game.model.state.rings.filter(r=>r.life==='active').length,
   steps:window.jadeDebug.game.model.state.steps
  }));
  if(state.active===0)break;
 }
 await page.waitForFunction(()=>window.jadeDebug.game.model?.cleared&&window.jadeDebug.game.settled&&window.jadeDebug.game.modalOpen,{timeout:30000});
 const final=await page.evaluate(()=>{
  const g=window.jadeDebug.game;
  return{steps:g.model.state.steps,activeRings:g.model.state.rings.filter(r=>r.life==='active').length,
   remainingClaspObjects:g.model.state.rods.filter(r=>g.Core.exists(g.model.state,r)).length,
   erasures:g.model.state.events.filter(e=>e.kind==='erase').length,
   title:g.victory?.title?.text||null};
 });
 assert.equal(final.activeRings,0);
 assert.equal(final.remainingClaspObjects,0);
 assert.equal(final.erasures,0,'route must not use the erase tool');
 assert.ok(final.steps>0&&final.steps<=route.length);
 assert.equal(report.errors.length,0,report.errors.join(' | '));
 report.initial=initial;report.final=final;report.toolsUsed=0;report.status='browser_pointer_route_passed';
 await writeFile(resolve(out,'level107-browser-proof.json'),JSON.stringify(report,null,2)+'\n');
 await page.screenshot({path:resolve(out,'level107-victory-mobile.png')});
 console.log('LEVEL107_BROWSER_PROOF='+JSON.stringify(report));
 await page.close();
}finally{
 await browser.close();
 await new Promise(r=>server.close(r));
}
