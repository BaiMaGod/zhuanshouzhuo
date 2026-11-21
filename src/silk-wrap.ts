export interface SilkPoint {x:number;y:number}

const PHASES=[0,Math.PI*2/3,Math.PI*4/3];

/**
 * Build the visible satin strands for a silk-wrapped jade bangle.
 * The paths follow the annular jade band and stop before the real clasp gap.
 * Each remaining layer is a real strand; no text or numeric badge is rendered.
 */
export function silkWrapPaths(
 layers:number,
 radius=40,
 band=12,
 gap=9,
 samples=144
):SilkPoint[][]{
 const count=Math.max(0,Math.min(3,Math.trunc(layers)));
 if(!count)return [];
 const inner=Math.max(.001,radius-band/2);
 const halfGap=Math.asin(Math.min(.999,gap/(2*inner)));
 const start=halfGap+.055,end=Math.PI*2-halfGap-.055;
 const amplitude=band*.34;
 const steps=Math.max(24,Math.floor(samples));
 return Array.from({length:count},(_,index)=>{
  const phase=PHASES[index],points:SilkPoint[]=[];
  for(let i=0;i<=steps;i++){
   const angle=start+(end-start)*i/steps;
   // One full helical pass around the bangle, with a slight irregularity
   // so the strands read as soft silk rather than perfect vector outlines.
   const radial=radius+amplitude*Math.sin(angle+phase)+.16*Math.sin(angle*3+phase*1.3);
   points.push({x:Math.cos(angle)*radial,y:Math.sin(angle)*radial});
  }
  return points;
 });
}
