// Interleave the middle row into its neighbors; keep ring and rod dimensions physical.
// Nine chambers form one connected serpentine puzzle, not independent boards.
// C's outgoing bridge prevents it rotating until the next chamber's G is removed.
const headings=[90,90,90,270,270,270,90,90,90];
const bases=[[0,0],[0,304],[0,608],[-490,685],[-490,381],[-490,77],[-584,-135],[-584,169],[-584,473]];
const shape=[['G',0,0,180],['A',106,0,110],['B',53,91.8,250],['C',212,0,200],['D',106,183.6,10],['E',0,183.6,190]];
const localLinks=[['m','G','A'],['m','G','B'],['b','A','B'],['m','A','C'],['m','B','D'],['m','D','E']];
const points=[],links=[];
const rotate=(x,y,a)=>{const d=a*Math.PI/180;return [x*Math.cos(d)-y*Math.sin(d),x*Math.sin(d)+y*Math.cos(d)]};
for(let i=0;i<9;i++){
 const [cx,cy]=bases[i],h=headings[i],prefix=String(i+1);
 for(const [id,x,y,a]of shape){const [rx,ry]=rotate(x,y,h);points.push([prefix+id,cx+rx,cy+ry,(a+h)%360])}
 for(const [kind,owner,target]of localLinks)links.push([kind,prefix+owner,prefix+target]);
}
for(let i=0;i<8;i++){
 const owner=points.find(p=>p[0]===String(i+1)+'C'),target=points.find(p=>p[0]===String(i+2)+'G');
 links.push(['m',owner[0],target[0]]);
 // The incoming sleeve starts aligned on G; G is still retained by its two outgoing cuffs.
 target[3]=(Math.atan2(owner[2]-target[2],owner[1]-target[1])*180/Math.PI+360)%360;
}
export default {name:'九宫锁玉阵',kind:'formal',tip:'54 镯环环相扣。观察实心座与空心扣，寻找能先拆开的外围，再逐步解开九宫机关。',points,links};
