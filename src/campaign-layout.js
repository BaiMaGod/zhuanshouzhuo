// Compact, hole-free oval cut from the existing 92.0001-unit hexagonal lattice.
// Pure geometry: generation never relaxes ring radii or collision rules.
const SPACING=92.0001, ROW=SPACING*Math.sqrt(3)/2;
export function campaignLayout(count){
 const cells=[];
 for(let row=-16;row<=16;row++)for(let col=-16;col<=16;col++){
  const x=(col+((row%2+2)%2)/2)*SPACING,y=row*ROW;
  cells.push({x,y,score:x*x+(y/1.32)**2});
 }
 cells.sort((a,b)=>a.score-b.score||a.y-b.y||a.x-b.x);
 const nodes=cells.slice(0,count).map((p,i)=>({...p,id:'R'+(i+1),parent:-1,depth:0}));
 for(let i=1;i<count;i++){
  const node=nodes[i],near=nodes.slice(0,i).map((p,j)=>({p,j})).filter(({p})=>Math.abs(Math.hypot(p.x-node.x,p.y-node.y)-SPACING)<.01);
  near.sort((a,b)=>b.p.depth-a.p.depth||a.p.score-b.p.score);
  if(!near.length)throw new Error('Disconnected campaign layout: '+count+'/'+i);
  node.parent=near[0].j;node.depth=near[0].p.depth+1;
 }
 return nodes;
}
export const peelOrder=nodes=>nodes.map((p,i)=>i).filter(i=>i>0).sort((a,b)=>nodes[b].depth-nodes[a].depth||nodes[b].score-nodes[a].score);
export const incomingAngle=(nodes,i)=>{
 const p=nodes[i],parent=nodes[p.parent];
 return (Math.atan2(parent.y-p.y,parent.x-p.x)*180/Math.PI+360)%360;
};
