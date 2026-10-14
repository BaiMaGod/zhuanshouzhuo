import type {Point} from './types.js';

// Safe playing surface inside art-v3/tray.png, excluding rim and ornaments.
export const TRAY_SURFACE={rx:.455,ry:.405};
export const RING_ENVELOPE=56; // Full rotating artwork and soft shadow, not just the centre.
export function trayFit(points:Point[],center:Point,width:number,height:number):number{
 const rx=width*TRAY_SURFACE.rx,ry=height*TRAY_SURFACE.ry;
 let extent=0;
 // Ellipse containment via support functions. Circumscribed envelope and
 // angular correction bound the unsampled directions as well.
 for(const p of points)for(let degree=0;degree<360;degree++){
  const a=degree*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  extent=Math.max(extent,((p.x-center.x)*c/rx+(p.y-center.y)*s/ry)+RING_ENVELOPE*Math.hypot(c/rx,s/ry));
 }
 return Math.cos(Math.PI/360)/extent;
}
