// Real gestures, read-only QA bridge observation, and live animation captures.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import solutions from '../src/solutions.js';
const root=resolve(process.env.JADE_DIST||'dist'),out=resolve(process.env.JADE_REPORT||'tests/results/feedback');
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const name=new URL(req.url,'http://local').pathname,file=resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(root+sep))throw Error('path');
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff':'font/woff','.wav':'audio/wav','.mp3':'audio/mpeg'})[extname(file)]||'application/octet-stream');
 res.end(await readFile(file));
}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const report={errors:[],profiles:[],artifacts:{}};
for(const file of ['js/main.js','js/renderer.js','js/feedback.js','js/victory.js']){
 try{report.artifacts[file]=createHash('sha256').update(await readFile(resolve(root,file))).digest('hex')}catch{}
}
try{
 const profiles=process.env.JADE_BASELINE?[[390,844,false]]:[[390,844,false],[360,640,false],[1280,720,false],[390,844,true]];
 for(const [width,height,quiet] of profiles){
  const id=width+'x'+height+(quiet?'-reduced':''),context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:width<600,isMobile:width<600,
   ...(width<600?{userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36'}:{}),
   reducedMotion:quiet?'reduce':'no-preference',...(process.env.JADE_VIDEO?{recordVideo:{dir:resolve(out,'video'),size:{width,height}}}:{})});
  const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));page.on('requestfailed',r=>report.errors.push(r.url()));
  page.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url())});
  await page.goto('http://127.0.0.1:'+server.address().port+'/?debug');
  await page.waitForFunction(()=>!!window.jadeDebug?.game&&!document.querySelector('#boot')&&!document.querySelector('#splash'));
  const click=async label=>{
   const p=await page.evaluate(label=>{
    const g=jadeDebug.game;
    const walk=(n,x=0,y=0,s=1)=>{if(n.visible===false)return;x+=n.x*s;y+=n.y*s;s*=n.scaleX;
     if(n.name===label||n.label?.text===label)return{x:x+n.width*s/2,y:y+n.height*s/2};
     for(let i=0;i<n.numChildren;i++){const p=walk(n.getChildAt(i),x,y,s);if(p)return p}};
    const p=walk(g.modalOpen?g.overlay:g.scene);if(!p)throw Error('Missing '+label);
    const r=document.querySelector('canvas').getBoundingClientRect();return{x:r.left+p.x/g.scene.width*r.width,y:r.top+p.y/g.scene.height*r.height};
   },label);await page.mouse.click(p.x,p.y);
  };
  const shot=async name=>{const file=id+'-'+name+'.png';await page.screenshot({path:resolve(out,file)});return file};
  await click('button:home');await click('第1关');
  const start=await shot('start');
  const steadyFrames=await page.evaluate(()=>new Promise(resolve=>{
   const samples=[];let last;const frame=now=>{if(last!==undefined)samples.push(now-last);last=now;
    if(samples.length<120)requestAnimationFrame(frame);else{samples.sort((a,b)=>a-b);resolve({p95Ms:samples[Math.floor(samples.length*.95)],samples:samples.length,budgetMs:33.3})}};
   requestAnimationFrame(frame);
  }));
  const cdp=await context.newCDPSession(page);
  const heldShot=async id=>{
   if(!captureHeld)return;captureHeld=false;
   if(!process.env.JADE_BASELINE){
    assert.equal(await page.evaluate(id=>jadeDebug.game.board.rings.get(id).focus.visible,id),true,'real pointer down emphasizes the held ring');
    assert.equal(await page.evaluate(id=>jadeDebug.game.board.rings.get(id).halo.visible,id),false,'no selected outline');
   }
   held=await shot('held');
  };
  const drag=async a=>{
   const points=await page.evaluate(a=>{
    const {game:g,Core:C}=jadeDebug,r=C.ring(g.model.state,a.id),box=document.querySelector('canvas').getBoundingClientRect();
    // Give touch a natural >20px arc, beyond the browser's tap movement slop.
    // Rules remove the ring as the opening crosses its real clasp; no state writes.
    const delta=a.delta+Math.sign(a.delta)*22,n=Math.ceil(Math.abs(delta)/2);
    return Array.from({length:n+1},(_,i)=>{const p=g.board.toScreen(C.point(r,r.a+50+delta*i/n));return{x:box.left+p.x/g.scene.width*box.width,y:box.top+p.y/g.scene.height*box.height}});
   },a);
   if(width<600){
    const touch=p=>[{id:1,x:p.x,y:p.y,radiusX:1,radiusY:1,force:1}];
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touch(points[0])});
    await page.waitForTimeout(40);
    await heldShot(a.id);
    for(const p of points.slice(1)){
     await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touch(p)});await page.waitForTimeout(24);
     if(await page.evaluate(id=>jadeDebug.Core.ring(jadeDebug.game.model.state,id).life!=='active',a.id))break;
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   }else{
    await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();
    await heldShot(a.id);
    for(const p of points.slice(1)){
     await page.mouse.move(p.x,p.y);await page.waitForTimeout(12);
     if(await page.evaluate(id=>jadeDebug.Core.ring(jadeDebug.game.model.state,id).life!=='active',a.id))break;
    }
    await page.mouse.up();
   }
  };
  const frames=[];
  // Capture frame timings over actual gestures and presentation, not a frozen scene.
  await page.evaluate(()=>{
   window.feedbackFrames=[];window.feedbackSampling=true;let last=performance.now();
   const sample=now=>{if(!window.feedbackSampling)return;window.feedbackFrames.push(now-last);last=now;requestAnimationFrame(sample)};requestAnimationFrame(sample);
  });
  let release,bloom,held;let captureHeld=true;
  for(const [i,a] of solutions[10].entries()){
   const count=await page.evaluate(()=>jadeDebug.game.model.state.rings.filter(r=>r.life==='active').length);
   await drag(a);
   const observed=await page.evaluate(()=>({active:jadeDebug.game.model.state.rings.filter(r=>r.life==='active').length,steps:jadeDebug.game.model.state.steps,drag:jadeDebug.game.drag,pointers:jadeDebug.game.pointers.size,rings:jadeDebug.game.model.state.rings,canvas:document.querySelector('canvas').getBoundingClientRect().toJSON(),scene:{w:jadeDebug.game.scene.width,h:jadeDebug.game.scene.height}}));
   if(observed.active>=count){await shot('failed-drag');console.log('Failed real drag',a,JSON.stringify(observed));}
   assert.ok(observed.active<count,'real drag removes a ring');
   if(i===0){
    if(!process.env.JADE_BASELINE)assert.ok(await page.evaluate(()=>jadeDebug.game.board.ghosts.length)>0||quiet);
    release=await shot('release');
   }
   if(i===solutions[10].length-1&&!quiet){await page.waitForTimeout(300);bloom=await shot('clear');}
   await page.waitForFunction(()=>!jadeDebug.game.board.animating);
  }
  await page.waitForFunction(()=>jadeDebug.game.model.cleared&&jadeDebug.game.settled&&jadeDebug.game.modalOpen);
  if(!quiet&&!process.env.JADE_BASELINE)await shot('stars-entering');
  await page.waitForTimeout(1200);
  const victory=await shot('victory');
  const state=await page.evaluate(()=>{
   const g=jadeDebug.game,c=g.modalCard;
   return{steps:g.model.state.steps,active:g.model.state.rings.filter(r=>r.life==='active').length,
    card:c.name,inside:c.x>=0&&c.y>=0&&c.x+c.width*c.scaleX<=g.scene.width&&c.y+c.height*c.scaleY<=g.scene.height,
    ghosts:g.board.ghosts.length,particles:g.board.sparks.length,effectChildren:g.board.effects.numChildren};
  });
  assert.equal(state.active,0);assert.equal(state.steps,solutions[10].length);assert.ok(state.inside);
  assert.equal(state.ghosts,0);assert.equal(state.particles,0);assert.equal(state.effectChildren,0);
  if(!process.env.JADE_BASELINE)assert.equal(state.card,'victory-card');
  const timings=await page.evaluate(()=>{window.feedbackSampling=false;return window.feedbackFrames.slice(1)});
  const sorted=timings.sort((a,b)=>a-b),p95=sorted[Math.floor(sorted.length*.95)];
  // Software-rendered browser timing is reported separately from real-device FPS.
  await click('再挑战一次');
  assert.equal(await page.evaluate(()=>jadeDebug.game.model.state.steps),0);
  assert.equal(await page.evaluate(()=>jadeDebug.game.modalOpen),false);
  for(const a of solutions[10]){await drag(a);await page.waitForFunction(()=>!jadeDebug.game.board.animating)}
  await page.waitForFunction(()=>jadeDebug.game.settled&&jadeDebug.game.modalOpen);
  await click('下一关');assert.equal(await page.evaluate(()=>jadeDebug.game.model.index),11);
  assert.equal(await page.evaluate(()=>jadeDebug.game.board.effects.numChildren),0);
  const next=await shot('next');
  await click('button:home');await click('确认返回');
  assert.equal(await page.evaluate(()=>jadeDebug.game.mode),'home');
  report.profiles.push({id,width,height,quiet,input:width<600?'CDP real touch drag':'mouse drag',state,p95Ms:p95,steadyFrames,screenshots:{start,held,release,bloom,victory,next}});
  await context.close();console.log('Feedback real play passed',id,'p95',p95);
 }
 assert.deepEqual(report.errors,[]);
}finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await browser.close();server.close()}
