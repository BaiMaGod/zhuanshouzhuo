import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright'):require('playwright');
const dist=resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.woff':'font/woff','.wav':'audio/wav'};
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://localhost').pathname,file=resolve(dist,path==='/'?'index.html':'.'+path);
 if(!file.startsWith(dist+sep)){res.writeHead(403).end();return}
 const data=await readFile(file);res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(data);
}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 for(const viewport of [{width:390,height:844},{width:1280,height:800}]){
  const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const base='http://127.0.0.1:'+server.address().port+'/';
  await page.goto(base);await page.waitForFunction(()=>!document.getElementById('boot'));
  assert.equal(await page.evaluate(()=>typeof window.jadeDebug),'undefined','default page has no debug bridge');
  await page.goto(base+'?debug=0');await page.waitForFunction(()=>!!window.jadeDebug?.game);
  await page.evaluate(()=>window.jadeDebug.game.load(10,true));
  const clickHint=async()=>{const p=await page.evaluate(()=>{
   const g=window.jadeDebug.game,b=g.hintButton,r=document.querySelector('canvas').getBoundingClientRect();
   return{x:r.left+(b.x+b.width/2)*r.width/720,y:r.top+(b.y+b.height/2)*r.height/g.scene.height};
  });await page.mouse.click(p.x,p.y)};
  const before=await page.evaluate(()=>window.jadeDebug.getState());
  await clickHint();await page.waitForFunction(()=>!!window.jadeDebug.game.guide?.action);
  await page.waitForTimeout(300);assert.deepEqual(await page.evaluate(()=>window.jadeDebug.getState()),before);
  await page.goto(base+'?debug=1');await page.waitForFunction(()=>!!window.jadeDebug?.game);
  const expected=await page.evaluate(()=>{
   const {game:g,Core:C}=window.jadeDebug;g.load(10,true);
   const a=g.model.hints.next(g.model.state),s=C.clone(g.model.state);C.request(s,a.id,a.delta);
   window.debugSamples=[];const draw=g.perform.bind(g);g.perform=(id,delta)=>{const res=draw(id,delta);window.debugSamples.push({id,a:C.ring(g.model.state,id).a});return res};
   return s;
  });
  await clickHint();await page.waitForFunction(()=>window.jadeDebug.game.busy);
  assert.equal(await page.evaluate(()=>window.jadeDebug.game.guide?.followRotation),true);
  await page.waitForFunction(()=>!window.jadeDebug.game.busy,undefined,{timeout:15000});
  const result=await page.evaluate(()=>({s:window.jadeDebug.getState(),samples:window.debugSamples,left:window.jadeDebug.game.hintLeft,guide:!!window.jadeDebug.game.guide}));
  assert.ok(result.samples.length>2);assert.equal(result.s.steps,1);assert.equal(result.left,0);assert.equal(result.guide,false);
  assert.deepEqual(result.s.rings.map(r=>r.life),expected.rings.map(r=>r.life));
  assert.ok(result.s.rings.every((r,i)=>Math.abs(((r.a-expected.rings[i].a+540)%360)-180)<.3));
  assert.deepEqual(errors,[]);await page.close();console.log('WebGL debug hint passed',viewport);
 }
}finally{await browser?.close();await new Promise(r=>server.close(r))}
