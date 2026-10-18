// Browser-only pixel regression: Node scene mocks cannot catch Laya/WebGL skin loss.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const dist=resolve('dist');
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css',
 '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
 '.woff':'font/woff','.woff2':'font/woff2','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'};
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url||'/', 'http://localhost').pathname);
  const file=path==='/'?resolve(dist,'index.html'):resolve(dist,'.'+path);
  if(file!==dist&&!file.startsWith(dist+sep)){res.writeHead(403).end();return}
  const bytes=await readFile(file);
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
  res.end(bytes);
 }catch{res.writeHead(404).end('Not found')}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:[
 '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist'
]});
try{
 const width=390,height=844,scale=width/720;
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
 page.on('pageerror',err=>console.error('Browser page error:',err.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?debug',{waitUntil:'load'});
 await page.waitForFunction(()=>!!window.jadeDebug?.game,{timeout:60000});
 await page.evaluate(()=>window.jadeDebug.game.home()); // First launch now opens tutorial.
 const point=(x,y)=>({x:Math.round(x*scale),y:Math.round(y*scale)});
 async function pixelRatio(rect){
  // Sample the stable light-pink interior, away from rounded corners.
  await page.waitForTimeout(180);
  const png=PNG.sync.read(await page.screenshot());
  let matches=0,total=0;
  const start=point(rect.x+9,rect.y+9),end=point(rect.x+rect.w-9,rect.y+rect.h-9);
  for(let y=start.y;y<end.y;y++)for(let x=start.x;x<end.x;x++){
   const i=(y*png.width+x)*4,r=png.data[i],g=png.data[i+1],b=png.data[i+2];
   total++;
   if(Math.abs(r-240)<16&&Math.abs(g-220)<17&&Math.abs(b-225)<17)matches++;
  }
  return matches/total;
 }
 async function check(name,rect,action){
  const before=await pixelRatio(rect);
  assert.ok(before>.35,name+': initial skin is not visible (pink ratio='+before.toFixed(3)+')');
  await action();
  const after=await pixelRatio(rect);
  console.log(name,'skin-color ratio:',before.toFixed(3),'->',after.toFixed(3));
  assert.ok(after>=before*.72,name+': button skin disappeared after action ('+after.toFixed(3)+')');
 }
 async function click(rect){
  const at=point(rect.x+rect.w/2,rect.y+rect.h/2);
  await page.mouse.click(at.x,at.y);
 }
 const settings={x:608,y:28,w:76,h:66};
 for(let n=0;n<3;n++)await check('home settings '+n,settings,async()=>{
  await click(settings);
  await page.waitForFunction(()=>window.jadeDebug.game.modalOpen);
  await page.evaluate(()=>window.jadeDebug.game.hideModal());
 });
 await page.evaluate(()=>window.jadeDebug.game.load(10));
 const top=[
  ['home', {x:28,y:26,w:76,h:64},true],
  ['restart',{x:116,y:26,w:76,h:64},true],
  ['sound',{x:528,y:26,w:76,h:64},false],
  ['help',{x:616,y:26,w:76,h:64},true]
 ];
 for(const [name,rect,modal] of top){
  await check('formal '+name,rect,async()=>{
   await click(rect);
   if(modal){
    await page.waitForFunction(()=>window.jadeDebug.game.modalOpen);
    await page.evaluate(()=>window.jadeDebug.game.hideModal());
   }
  });
 }
 const H=await page.evaluate(()=>window.jadeDebug.game.scene.height);
 const hint={x:28,y:H-84,w:146,h:62},erase={x:548,y:H-84,w:144,h:62};
 await check('formal hint',hint,async()=>{
  await click(hint);
  await page.waitForFunction(()=>!window.jadeDebug.game.busy,{timeout:45000});
 });
 await check('formal erase',erase,async()=>{await click(erase)});
 console.log('Browser button pixel regression passed.');
 await page.close();
}finally{
 await browser.close();
 await new Promise(r=>server.close(r));
}
