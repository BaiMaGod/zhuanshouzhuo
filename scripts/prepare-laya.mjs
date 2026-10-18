import {cpSync,rmSync,readdirSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {RUNTIME_IMAGES,auditImages,verifyPackagedImages} from './runtime-images.mjs';
auditImages();
rmSync('laya/src/bracelet',{recursive:true,force:true});
cpSync('dist/js','laya/src/bracelet',{recursive:true});
rmSync('laya/src/bracelet/audio-dsp.js',{force:true});
rmSync('laya/src/bracelet/solver-worker.js',{force:true});
for(const name of readdirSync('laya/src/bracelet').filter(n=>n.endsWith('.js'))){
 const path='laya/src/bracelet/'+name;
 let code=readFileSync(path,'utf8').replace(/\?v=\d+\.\d+\.\d+/g,'');
 if(name==='main.js'){
  const start=code.indexOf('boot().catch');if(start<0)throw Error('Web startup marker missing');
  code=code.slice(0,start)+'export {boot};\n';
 }
 writeFileSync(path,code);
}
// All runtime assets have stable paths. No HTML shell or browser worker is packaged.
rmSync('laya/assets/assets',{recursive:true,force:true});mkdirSync('laya/assets/assets',{recursive:true});
for(const name of ['fonts','audio'])cpSync('public/assets/'+name,'laya/assets/assets/'+name,{recursive:true});
for(const name of RUNTIME_IMAGES){const target='laya/assets/assets/'+name;mkdirSync(dirname(target),{recursive:true});cpSync('public/assets/'+name,target)}
verifyPackagedImages('laya/assets/assets');
// Unused prior art and original audio sources are not included in the runtime package.
for(const name of ['ceramic_drag_1','ceramic_place_1'])rmSync('laya/assets/assets/audio/'+name+'.wav',{force:true});
