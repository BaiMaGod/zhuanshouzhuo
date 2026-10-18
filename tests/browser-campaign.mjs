// Real browser coverage for the 100-level campaign. Gameplay uses actual input;
// the debug bridge is only read to locate controls and observe rule state.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
import solutions from '../src/solutions.js';
const root=resolve(process.env.JADE_DIST||'dist'),out=resolve(process.env.JADE_REPORT||'tests/results/campaign');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://local').pathname;
  const file=resolve(root,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+sep))throw Error('path');
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.woff':'font/woff','.wav':'audio/wav'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(404).end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const report={errors:[],profiles:[]};
async function button(page,label){
 await page.waitForFunction(label=>{
  const g=window.jadeDebug?.game;if(!g||g.modalOpen&&g.modalCard?.alpha<.99)return false;
  const walk=n=>{if(n.visible===false)return false;if(n.name===label||n.label?.text===label||(label==='提示'&&n.label?.text?.startsWith('提示 ×')))return n.enabled!==false;for(let i=0;i<n.numChildren;i++)if(walk(n.getChildAt(i)))return true;return false};
  return walk(g.modalOpen?g.overlay:g.scene);
 },label);
 const p=await page.evaluate(label=>{
  const g=window.jadeDebug.game;
  const walk=(n,x=0,y=0)=>{
   x+=n.x;y+=n.y;
   if(n.name===label||n.label?.text===label||(label==='提示'&&n.label?.text?.startsWith('提示 ×')))return{x:x+n.width/2,y:y+n.height/2};
   for(let i=0;i<n.numChildren;i++){const q=walk(n.getChildAt(i),x,y);if(q)return q}
  };
  const q=walk(g.modalOpen?g.overlay:g.scene);if(!q)throw Error('Missing button: '+label);
  const r=document.querySelector('canvas').getBoundingClientRect();return{x:r.left+q.x/g.scene.width*r.width,y:r.top+q.y/g.scene.height*r.height};
 },label);
 await page.mouse.click(p.x,p.y);await page.waitForTimeout(80);
}
async function drag(page,a){
 const points=await page.evaluate(a=>{
  const {game:g,Core:C}=window.jadeDebug,r=C.ring(g.model.state,a.id),start=r.a+50,box=document.querySelector('canvas').getBoundingClientRect(),n=Math.ceil(Math.abs(a.delta)/3);
  return Array.from({length:n+1},(_,i)=>{const p=g.board.toScreen(C.point(r,start+a.delta*i/n));return{x:box.left+p.x/g.scene.width*box.width,y:box.top+p.y/g.scene.height*box.height}});
 },a);
 await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();
 for(const p of points.slice(1))await page.mouse.move(p.x,p.y);
 await page.mouse.up();await page.waitForTimeout(350);
}
try{
 for(const [width,height] of [[360,640],[390,844],[1280,720]]){
  const p=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  p.on('pageerror',e=>report.errors.push(e.message));p.on('requestfailed',r=>report.errors.push(r.url()));
  p.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url())});
  await p.goto('http://127.0.0.1:'+server.address().port+'/?debug');
  await p.waitForFunction(()=>window.jadeDebug?.game&&!document.querySelector('#boot')&&(!document.querySelector('#splash')||getComputedStyle(document.querySelector('#splash')).display==='none'));
  assert.equal(await p.evaluate(()=>window.jadeDebug.game.model?.index),0,'First visit opens the first tutorial');
  await p.evaluate(()=>window.jadeDebug.game.home());
  await button(p,'第1关');
  assert.equal(await p.evaluate(()=>window.jadeDebug.game.model.state.rings.length),10);
  const route=solutions[10];
  for(const a of route)await drag(p,a);
  assert.equal(await p.evaluate(()=>window.jadeDebug.game.model.cleared),true);
  await p.waitForFunction(()=>window.jadeDebug.game.modalOpen&&window.jadeDebug.game.settled);
  await button(p,'下一关');assert.equal(await p.evaluate(()=>window.jadeDebug.game.model.index),11);
  await button(p,'button:home');await button(p,'确认返回');
  // Reenter the homepage: its main button must resume the next uncompleted level.
  await button(p,'第2关');assert.equal(await p.evaluate(()=>window.jadeDebug.game.model.index),11);
  await button(p,'button:home');await button(p,'确认返回');await button(p,'关卡图谱');
  await p.screenshot({path:resolve(out,width+'-page1.png')});

  // Seed previously earned records as a returning player would have them.
  // The first formal level above was genuinely cleared with real gestures.
  await p.evaluate(()=>{
   const key='jade-bracelet-laya-v1',progress=JSON.parse(localStorage.getItem(key));
   for(let i=10;i<54;i++)progress.records[i]??={steps:i-9,stars:2};
   localStorage.setItem(key,JSON.stringify(progress));
  });
  await p.reload();await p.waitForFunction(()=>window.jadeDebug?.game&&!document.querySelector('#boot')&&(!document.querySelector('#splash')||getComputedStyle(document.querySelector('#splash')).display==='none'));
  await button(p,'关卡图谱');await p.screenshot({path:resolve(out,width+'-level45-page.png')});
  await button(p,'formal-level:45');
  assert.equal(await p.evaluate(()=>window.jadeDebug.game.model.state.rings.length),54);
  await p.screenshot({path:resolve(out,width+'-level45.png')});
  await button(p,'button:home');await button(p,'确认返回');

  await p.evaluate(()=>{
   const key='jade-bracelet-laya-v1',progress=JSON.parse(localStorage.getItem(key));
   for(let i=10;i<109;i++)progress.records[i]??={steps:i-9,stars:2};
   localStorage.setItem(key,JSON.stringify(progress));
  });
  await p.reload();await p.waitForFunction(()=>window.jadeDebug?.game&&!document.querySelector('#boot')&&(!document.querySelector('#splash')||getComputedStyle(document.querySelector('#splash')).display==='none'));
  await button(p,'关卡图谱');await p.screenshot({path:resolve(out,width+'-page5.png')});
  await button(p,'formal-level:100');
  assert.equal(await p.evaluate(()=>window.jadeDebug.game.model.state.rings.length),109);
  assert.equal(await p.evaluate(()=>[...window.jadeDebug.game.board.rings.values()].every(v=>v.label.text==='')),true);
  await p.screenshot({path:resolve(out,width+'-level100.png')});
  await button(p,'提示');
  await p.waitForFunction(()=>!!window.jadeDebug.game.guide?.action);
  const action=await p.evaluate(()=>window.jadeDebug.game.guide.action);
  const before=await p.evaluate(id=>window.jadeDebug.Core.ring(window.jadeDebug.game.model.state,id).a,action.id);
  await drag(p,action);
  assert.ok(await p.evaluate(({id,before})=>{const {Core:C,game:g}=window.jadeDebug,r=C.ring(g.model.state,id);return r.life==='removed'||Math.abs(C.diff(r.a,before))>1},{id:action.id,before}),'actual level100 gesture performs the hinted alignment');
  // On slower desktop software WebGL, the 260ms release animation can
  // outlast the fixed drag delay. A disabled button must not be clicked yet.
  await p.waitForFunction(()=>{
   const g=window.jadeDebug.game;
   return !g.board.animating&&!g.busy&&g.hintButton.enabled;
  });
  // Formal levels allow only one hint per attempt. Extra taps show a notice.
  await button(p,'提示');
  assert.equal(await p.evaluate(()=>window.jadeDebug.game.hintLeft),0);
  assert.equal(await p.evaluate(()=>window.jadeDebug.game.eraseTip.text),'本关提示已用完');
  assert.equal(await p.evaluate(()=>window.jadeDebug.game.model.state.steps),1);
  await button(p,'button:restart');await button(p,'确认重开');
  assert.equal(await p.evaluate(()=>window.jadeDebug.game.model.state.rings.filter(r=>r.life==='active').length),109);
  await button(p,'+');
  assert.ok(await p.evaluate(()=>window.jadeDebug.game.board.zoom>window.jadeDebug.game.board.fitZoom));
  await button(p,'全盘');
  assert.equal(await p.evaluate(()=>window.jadeDebug.game.board.zoom===window.jadeDebug.game.board.fitZoom),true);
  report.profiles.push({width,height,firstLevelCleared:true,legacyLevel:45,lastLevel:100,lastCount:109,hintAfterInput:true});
  console.log('Browser campaign passed:',width,height);await p.close();
 }
 assert.deepEqual(report.errors,[]);
 await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));
}finally{await browser.close();server.close()}
