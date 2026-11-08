// Visual fixtures only; real touch gameplay is exercised by browser-input.mjs.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
const out=process.env.JADE_REPORT||'tests/results/images';await mkdir(out,{recursive:true});
const root=resolve(process.env.JADE_DIST||'dist');
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://local'),file=resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+sep))throw Error('path');
 res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.woff':'font/woff','.wav':'audio/wav'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const report=[];
try{
 for(const [width,height,dpr] of [[390,844,1],[390,844,2],[390,844,3],[1280,720,1]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  page.on('requestfailed',r=>errors.push(r.url()));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
  await page.goto((process.env.JADE_URL||'http://127.0.0.1:'+server.address().port+'/')+'?debug');
  await page.waitForFunction(()=>window.jadeDebug?.game&&!document.querySelector('#boot'));
  const shot=async name=>{await page.waitForTimeout(250);await page.mouse.move(0,0);await page.screenshot({path:`${out}/${width}-${name}.png`})};
  await shot('tutorial');
  async function click(label){
   const p=await page.evaluate(label=>{
    const g=jadeDebug.game;function find(n){if(n.visible===false)return null;if(n.name===label||n.label?.text===label)return n;for(let i=0;i<n.numChildren;i++){const b=find(n.getChildAt(i));if(b)return b}return null}
    const b=find(g.modalOpen?g.overlay:g.scene);if(!b)throw Error(label);
    const p=b.localToGlobal(new Laya.Point(b.width/2,b.height/2)),box=document.querySelector('canvas').getBoundingClientRect();
    return {x:box.left+p.x/Laya.stage.width*box.width,y:box.top+p.y/Laya.stage.height*box.height};
   },label);await page.mouse.click(p.x,p.y);await page.waitForTimeout(100);
  }
  await click('button:home');await shot('home');await click('第1关');await shot('formal1');
  const render=await page.evaluate(()=>jadeDebug.getRenderDiagnostics());
  assert.equal(render.device.dpr,dpr,'browser DPR must be reported accurately');
  assert.ok(render.canvas.css.width>0&&render.canvas.css.height>0,'canvas must have a measurable CSS display size');
  assert.ok(render.canvas.backing.width>=render.canvas.css.width,
   `canvas backing width must not undersample CSS output: ${JSON.stringify(render.canvas)}`);
  assert.ok(render.canvas.backing.height>=render.canvas.css.height,
   `canvas backing height must not undersample CSS output: ${JSON.stringify(render.canvas)}`);
  assert.ok(render.canvas.backingPerCss.x>=1&&render.canvas.backingPerCss.y>=1,
   `canvas must render at least one backing pixel per CSS pixel: ${JSON.stringify(render.canvas)}`);
  assert.equal(render.assets.jadeAmber.width,512,'jade master texture must retain its original pixel width');
  assert.equal(render.assets.tray.width,1122,'tray texture must retain its original pixel width');
  assert.equal(render.assets.tray.height,1402,'tray texture must retain its original pixel height');
  assert.equal(render.assets.homeBackground.width,1024,'home background must retain its original pixel width');
  assert.equal(render.assets.homeBackground.height,1536,'home background must retain its original pixel height');
  assert.equal(render.assets.homeLogoPart3.width,480,'logo source width must be reported without resampling');
  const expectedCacheMode=dpr>=2?'none':'normal';
  assert.equal(render.cacheLayers.rods,expectedCacheMode,'rod cache policy must adapt to device DPR');
  assert.equal(render.cacheSamples[0].body.mode,expectedCacheMode,'jade body cache policy must adapt to device DPR');
  assert.equal(render.cacheSamples[0].focus.mode,expectedCacheMode,'ring focus cache policy must adapt to device DPR');
  for(let i=0;i<12;i++)await click('+');
  assert.ok(await page.evaluate(()=>Math.abs(jadeDebug.game.board.zoom-3.4)<1e-6));await shot('maximum-zoom');
  await click('全盘');await click('提示 ×1');await shot('hint');
  // A fixed high-density visual fixture; this does not count as a gameplay pass.
  await page.evaluate(()=>jadeDebug.game.load(109,true));await shot('formal100');
  const fps=await page.evaluate(()=>new Promise(resolve=>{
   let frames=0;const start=performance.now();
   const tick=(now)=>{frames++;if(now-start>=1000)resolve(Math.round(frames*1000/(now-start)));else requestAnimationFrame(tick)};
   requestAnimationFrame(tick);
  }));
  assert.ok(fps>=45,`high-DPI level100 frame rate below 45 FPS: ${fps}`);
  const memory=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/assets\/.*\.(png|jpg)/.test(r.name)).reduce((n,r)=>n+r.decodedBodySize,0));
  assert.deepEqual(errors,[]);report.push({width,height,dpr,fps,errors,downloadedImageBytes:memory,render});console.log('[high-dpi-render]',JSON.stringify({width,height,dpr,fps,device:render.device,canvas:render.canvas,stage:render.stage,game:render.game,cacheLayers:render.cacheLayers,cacheSamples:render.cacheSamples,assets:render.assets,imageScaling:render.imageScaling}));await page.close();
 }
 await writeFile(out+'/report.json',JSON.stringify(report,null,2));
}finally{await browser.close();server.close()}
