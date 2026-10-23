// Floral UI art for the sign-in calendar, brocade pouch and reward medallions.
// Kept as lightweight Laya vector graphics so buttons stay crisp at every DPR
// and never depend on external image fetching or a large atlas.
import {curvedPath,flower,round,THEME} from './ui.js';

type Shortcut='signin'|'bag';
type Gift='hint'|'erase';
const GOLD='#c9a17d',GOLD_LIGHT='#f7e9cb',PINK='#f5d8df',BERRY='#ae637a',PAPER='#fffaf7';
const path=(g:Laya.Graphics,cmd:unknown[][],fill?:string,line?:string,weight=1.3)=>
 curvedPath(g,0,0,cmd,fill?{fillStyle:fill}:undefined,line?{strokeStyle:line,lineWidth:weight}:undefined);
function petal(g:Laya.Graphics,x:number,y:number,size:number,angle:number,color=PINK):void{
 const dx=Math.cos(angle),dy=Math.sin(angle),px=-dy,py=dx;
 path(g,[['moveTo',x,y],
  ['quadraticCurveTo',x+dx*size*.48+px*size*.5,y+dy*size*.48+py*size*.5,x+dx*size,y+dy*size],
  ['quadraticCurveTo',x+dx*size*.48-px*size*.5,y+dy*size*.48-py*size*.5,x,y],
  ['closePath']],color,THEME.line,.65);
}
function blossom(g:Laya.Graphics,x:number,y:number,r:number):void{
 for(let k=0;k<5;k++)petal(g,x,y,r,(k*2*Math.PI/5)-Math.PI/2,PINK);
 g.drawCircle(x,y,r*.16,'#dfaa83');
 g.drawCircle(x-r*.05,y-r*.05,r*.06,PAPER);
}
function glitter(g:Laya.Graphics,x:number,y:number,size:number,color=GOLD):void{
 g.drawLine(x-size,y,x+size,y,color,1);
 g.drawLine(x,y-size*1.45,x,y+size*1.45,color,1);
 g.drawCircle(x,y,1.1,color);
}
function string(g:Laya.Graphics,x:number,y:number,off=0):void{
 path(g,[['moveTo',x,y],['quadraticCurveTo',x+4+off,y+5,x-2+off,y+13],['quadraticCurveTo',x-5+off,y+18,x+off,y+21]],undefined,GOLD,1.4);
 g.drawCircle(x+off,y+21,3,'#f3d4be',GOLD,.9);
 for(let i=0;i<5;i++)g.drawLine(x+off-3+i*1.5,y+23,x+off-7+i*2.2,y+35,BERRY,.75);
}
function calendar(g:Laya.Graphics):void{
 // Hanging floral calendar / silk-edged scroll, sized for a 96px home shortcut.
 path(g,[['moveTo',23,16],['quadraticCurveTo',48,0,71,16]],undefined,GOLD,1.4);
 g.drawCircle(23,16,2.4,GOLD_LIGHT,GOLD,1);g.drawCircle(71,16,2.4,GOLD_LIGHT,GOLD,1);
 round(g,21,17,53,47,5,'#fff6ed',GOLD,1.8);
 round(g,25,21,45,39,3,PAPER,'#ddb1ae',.9);
 round(g,21,17,53,12,4,'#eed0d6',GOLD,1.1);
 g.drawLine(30,35,65,35,THEME.line,1);
 for(let row=0;row<2;row++)for(let col=0;col<3;col++){
  g.drawCircle(33+col*14,42+row*10,2.15,'#c18a99');
 }
 g.drawPoly(52,48,[0,3,4,7,12,-2,10,-4,4,3],null,GOLD,1.3);
 g.drawCircle(74,16,3,'#f6e1c1',GOLD,.8);
 blossom(g,72,18,8);blossom(g,26,59,5);
 string(g,71,58,3);
 glitter(g,16,41,3);glitter(g,78,44,2.5);
}
function pouch(g:Laya.Graphics):void{
 // Hand-embroidered brocade pouch with cinched mouth, pearl and tassel.
 path(g,[['moveTo',31,27],['quadraticCurveTo',27,35,22,48],
  ['quadraticCurveTo',20,64,48,66],['quadraticCurveTo',76,64,74,48],
  ['quadraticCurveTo',67,33,64,27],['closePath']], '#ebbac7',BERRY,1.6);
 path(g,[['moveTo',28,42],['quadraticCurveTo',33,53,25,59],['quadraticCurveTo',48,75,71,59],
  ['quadraticCurveTo',62,52,69,41]],undefined,'#fff0ec',1.8);
 path(g,[['moveTo',30,29],['quadraticCurveTo',47,37,64,29]],undefined,GOLD,1.6);
 round(g,30,22,35,9,4,'#f5d4d3',GOLD,1.35);
 // Embroidered ribbon and bow.
 path(g,[['moveTo',46,27],['quadraticCurveTo',27,11,34,29],
 ['quadraticCurveTo',40,35,46,27],['quadraticCurveTo',67,11,59,30],
 ['quadraticCurveTo',54,34,46,27]],'#fff0ec',GOLD,1.2);
 g.drawCircle(47,27,3.7,GOLD_LIGHT,GOLD,.9);
 // Pearl-flower medallion on the pouch.
 blossom(g,49,48,10);g.drawCircle(49,48,3.3,'#fffcf4',GOLD,1);
 g.drawLine(42,39,36,34,GOLD,1);g.drawLine(56,41,63,35,GOLD,1);
 glitter(g,17,34,2.8);glitter(g,80,48,2.7);
 string(g,72,57,1);
}
export function drawHomeShortcut(g:Laya.Graphics,kind:Shortcut):void{
 // Double inset rim remains subordinate to the game's main start button.
 round(g,.75,.75,94.5,98.5,16,'#f8e9ec',THEME.line,1.2);
 round(g,4,4,88,92,13,'#fcf2f1','#e9c2cb',.8);
 path(g,[['moveTo',10,13],['quadraticCurveTo',15,8,24,10]],undefined,'#fffafa',1.5);
 if(kind==='signin')calendar(g);else pouch(g);
 flower(g,11,87,2.2,THEME.line);flower(g,85,87,2.2,THEME.line);
}
export function drawGift(g:Laya.Graphics,kind:Gift,x:number,y:number,size:number):void{
 // All coordinates scale from a 48px badge.
 const s=size/48;
 const circle=(cx:number,cy:number,r:number,fill:string,stroke?:string,strokeWidth=1)=>
  g.drawCircle(x+cx*s,y+cy*s,r*s,fill,stroke,strokeWidth*s);
 const line=(x1:number,y1:number,x2:number,y2:number,color:string,width=1)=>
  g.drawLine(x+x1*s,y+y1*s,x+x2*s,y+y2*s,color,width*s);
 if(kind==='hint'){
  circle(24,20,16,'#fce6ad','#d4a06e',1.2);circle(20,14,5,'#fff7d5');
  path(g,[['moveTo',x+19*s,y+34*s],['lineTo',x+29*s,y+34*s],['lineTo',x+27*s,y+40*s],
   ['lineTo',x+21*s,y+40*s],['closePath']],'#e7ab70','#bc7e63',1.1*s);
  line(18,37,30,37,'#bc7e63',1.3);
  line(24,4,24,0,GOLD,1.2);line(7,16,2,14,GOLD,1.2);line(40,16,45,14,GOLD,1.2);
  glitter(g,x+39*s,y+6*s,2.5*s);
  blossom(g,x+36*s,y+33*s,5.6*s);
 }else{
  // Pink gemstone eraser: diamond silhouette matches current "消除" pictogram.
  path(g,[['moveTo',x+24*s,y+4*s],['lineTo',x+44*s,y+24*s],['lineTo',x+24*s,y+44*s],
   ['lineTo',x+4*s,y+24*s],['closePath']],'#f9d4d9','#ae657b',1.8*s);
  path(g,[['moveTo',x+24*s,y+11*s],['lineTo',x+37*s,y+24*s],['lineTo',x+24*s,y+37*s],
   ['lineTo',x+11*s,y+24*s],['closePath']],PAPER,'#ce91a2',1.1*s);
  line(5,24,24,43,'#f6bdc9',2);
  blossom(g,x+40*s,y+39*s,5*s);
  glitter(g,x+6*s,y+5*s,2*s);
 }
}
export function drawRewardFrame(g:Laya.Graphics,w:number,h:number,special=false):void{
 round(g,0,0,w,h,15,special?'#fff0ef':'#fffbf7',special?'#d6a475':'#d7a5ae',special?2.2:1.3);
 round(g,4,4,w-8,h-8,12,special?'#fff6f3':'#fffaf8',special?'#eed1bd':'#f3e0e2',.8);
 if(special){
  flower(g,11,12,3,THEME.rose);flower(g,w-11,12,3,THEME.rose);
  flower(g,11,h-12,3,THEME.rose);flower(g,w-11,h-12,3,THEME.rose);
  glitter(g,w*.5,9,3,'#d1a16f');
 }
}
