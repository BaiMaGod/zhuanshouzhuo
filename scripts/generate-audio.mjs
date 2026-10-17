import {readFileSync,writeFileSync} from 'node:fs';
import {cueBuffer} from './audio-dsp.mjs';
const createBuffer=(channels,length,sampleRate)=>{const data=Array.from({length:channels},()=>new Float32Array(length));return{length,sampleRate,numberOfChannels:channels,getChannelData:i=>data[i]}};
const ctx={sampleRate:44100,createBuffer};
function read(name){
 const b=readFileSync('public/assets/audio/'+name+'.wav');let rate,channels,bits,data;
 for(let p=12;p+8<=b.length;){const n=b.readUInt32LE(p+4),tag=b.toString('ascii',p,p+4);if(tag==='fmt '){if(b.readUInt16LE(p+8)!==1)throw Error('PCM required');channels=b.readUInt16LE(p+10);rate=b.readUInt32LE(p+12);bits=b.readUInt16LE(p+22)}if(tag==='data')data=b.subarray(p+8,p+8+n);p+=8+n+(n%2)}
 if(bits!==16||!data)throw Error('16-bit WAV required');const out=createBuffer(channels,data.length/2/channels,rate);
 for(let i=0;i<out.length;i++)for(let c=0;c<channels;c++)out.getChannelData(c)[i]=data.readInt16LE((i*channels+c)*2)/32768;
 return out;
}
// Bake the existing low-pass timbre into portable PCM; no runtime Web Audio needed.
function lowpass(buffer,hz){for(let c=0;c<buffer.numberOfChannels;c++){
 const d=buffer.getChannelData(c),w=2*Math.PI*hz/buffer.sampleRate,cos=Math.cos(w),alpha=Math.sin(w)/(2*Math.SQRT1_2),a0=1+alpha;
 const b0=(1-cos)/2/a0,b1=(1-cos)/a0,b2=b0,a1=-2*cos/a0,a2=(1-alpha)/a0;let x1=0,x2=0,y1=0,y2=0;
 for(let i=0;i<d.length;i++){const x=d[i],y=b0*x+b1*x1+b2*x2-a1*y1-a2*y2;d[i]=y;x2=x1;x1=x;y2=y1;y1=y}
 }return buffer}
function write(name,b){const bytes=b.length*b.numberOfChannels*2,out=Buffer.alloc(44+bytes);out.write('RIFF');out.writeUInt32LE(36+bytes,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(b.numberOfChannels,22);out.writeUInt32LE(b.sampleRate,24);out.writeUInt32LE(b.sampleRate*b.numberOfChannels*2,28);out.writeUInt16LE(b.numberOfChannels*2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(bytes,40);for(let i=0;i<b.length;i++)for(let c=0;c<b.numberOfChannels;c++)out.writeInt16LE(Math.round(Math.max(-1,Math.min(1,b.getChannelData(c)[i]))*32767),44+(i*b.numberOfChannels+c)*2);writeFileSync('public/assets/audio/'+name+'.wav',out)}
// The selected ratchet_tick.wav is a mastered user-approved recording.
// Do not regenerate or overwrite it with synthetic/ceramic friction.
write('collision',lowpass(read('ceramic_place_1'),3400));
// Alignment uses a mastered Glass Tink recording (align_glass_tink.mp3).
// Never synthesize or overwrite that asset during audio:generate.
for(const n of ['button','clear','tool','win'])write(n,lowpass(cueBuffer(ctx,n),6200));
