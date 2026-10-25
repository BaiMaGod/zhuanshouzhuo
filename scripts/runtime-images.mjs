// Shared by Web/H5 and official Laya exports. Masters never enter a build.
import {readFileSync,statSync,readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
export const RUNTIME_IMAGES=[
 ...['amber','peach','celadon','ice','ivory'].map(n=>'jade-v2/'+n+'.png'),
 'art-v3/clasp.png','art-rose/tray.png','art-rose/hint-hand.png',
 'art-rose/home-bg.jpg','shadow.png',
 ...['signin-shortcut','bag-shortcut','signin-panel','bag-panel'].map(n=>'art-rose/'+n+'.webp')
];
export const IMAGE_BUDGET=3*1024*1024;
export function auditImages(root='public/assets'){
 const rows=RUNTIME_IMAGES.map(path=>{
  const buffer=readFileSync(join(root,path));
  const size=path.endsWith('.png')?{width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)}:{};
  if(path.endsWith('.png')&&!buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Invalid PNG: '+path);
  // A deliberate full-resolution tray exception preserves zoomed marble detail.
  if(buffer.length>500*1024)console.warn('[images] Review >500 KiB: '+path+' ('+buffer.length+' bytes)');
  return {path,bytes:buffer.length,...size};
 });
 const bytes=rows.reduce((sum,row)=>sum+row.bytes,0);
 if(bytes>IMAGE_BUDGET)throw Error('Runtime images exceed 3 MiB: '+bytes);
 const expected=new Map([...RUNTIME_IMAGES.filter(p=>p.startsWith('jade-v2/')).map(p=>[p,[512,512]]),
  ['art-v3/clasp.png',[128,49]],['art-rose/tray.png',[1122,1402]],['art-rose/hint-hand.png',[512,512]],['shadow.png',[256,256]]]);
 for(const row of rows){const size=expected.get(row.path);if(size&&(row.width!==size[0]||row.height!==size[1]))throw Error('Unexpected runtime dimensions: '+row.path)}
 return {count:rows.length,bytes,budget:IMAGE_BUDGET,images:rows};
}
export function verifyPackagedImages(root){
 const report=auditImages(root),found=[];
 function walk(dir){for(const name of readdirSync(dir)){const p=join(dir,name);if(statSync(p).isDirectory())walk(p);else if(/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(name))found.push(relative(root,p).replaceAll('\\','/'))}}
 walk(root);
 if(JSON.stringify(found.sort())!==JSON.stringify([...RUNTIME_IMAGES].sort()))throw Error('Unexpected image in runtime package');
 return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(auditImages(process.argv[2]),null,2));
