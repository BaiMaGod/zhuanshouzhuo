// Presentation timing only. No rule, scoring or angular tolerance lives here.
export const FEEDBACK={release:300,particles:900,alignment:360,clearBloom:720,clear:1080,maxGhosts:32,maxParticles:192};
export function reducedMotion():boolean{
 return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
export const easeOut=(t:number):number=>1-(1-Math.max(0,Math.min(1,t)))**3;
export function glint(g:Laya.Graphics,x:number,y:number,r:number,color:string):void{
 g.drawPoly(x,y,[0,-r,r*.26,-r*.26,r,0,r*.26,r*.26,0,r,-r*.26,r*.26,-r,0,-r*.26,-r*.26],color);
}
