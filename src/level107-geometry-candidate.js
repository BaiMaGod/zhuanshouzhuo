// Engineering geometry candidate for formal level 107. NOT release-ready.
// Ring attributes, per-owner quotas and background target pairs are read from
// the reviewed workbook source; the coordinates and receiver edges are proposed.
import {campaignLayout} from './campaign-layout.js';
const MAP='0,1,6,5,103,107,104,108,99,100,78,106,77,105,81,101,68,102,89,97,90,98,85,93,88,96,84,92,61,51,40,53,54,74,56,57,25,59,60,50,22,91,64,69,19,67,45,70,49,36,35,55,65,20,79,58,86,17,82,87,47,94,95,4,3,9,13,48,71,16,38,39,24,41,42,43,46,72,76,14,63,15,44,18,21,27,62,66,23,26,83,80,29,30,75,28,34,32,37,33,52,73,31,2,7,8,11,10,12'.split(',').map(Number);
const EDGES='1:3 1:4 2:1 2:4 71:35 72:36 72:53 78:33 78:57 81:30 81:55 85:50 86:76 87:34 88:56 88:59 88:62 91:30 92:46 93:32 93:72 94:31 95:44 95:60 97:90 98:39 99:51 100:49 101:43 101:71 102:29 102:63 103:58 103:38 105:45 105:54 106:41 107:37 107:58 64:70 65:64 66:103 67:66 68:79 69:47 70:94 71:51 73:68 73:96 74:100 74:102 75:34 75:39 76:95 76:61 77:33 77:78 79:83 79:48 80:96 80:73 80:54 81:91 82:65 82:93 82:106 83:79 83:101 83:48 84:109 84:97 84:98 85:72 85:93 86:67 86:99 87:75 87:40 89:86 89:66 89:76 90:77 90:40 90:94 91:44 91:42 92:35 92:43 93:37 94:77 94:41 95:61 96:83 96:71 96:101 97:87 97:40 98:75 98:68 99:52 99:81 100:29 100:107 101:48 102:38 103:74 104:3 104:80 104:105 104:108 105:67 105:80 106:64 106:85 106:65 107:82 107:65 108:84 108:98 108:80 108:73 109:90 109:97 109:64 109:70';
const id=n=>'R'+String(n).padStart(3,'0');
const norm=a=>((a%360)+360)%360, d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angle=(a,b)=>norm(Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI);
const point=(p,a,length)=>({x:p.x+Math.cos(a*Math.PI/180)*length,y:p.y+Math.sin(a*Math.PI/180)*length});
const rot=(p,a)=>{const t=a*Math.PI/180;return{x:p.x*Math.cos(t)-p.y*Math.sin(t),y:p.x*Math.sin(t)+p.y*Math.cos(t)}};

export function buildLevel107GeometryCandidate(source){
 if(source?.level!==107||source.rings?.length!==109||source.backgroundPieces?.length!==14)
  throw Error('Expected complete original level107 ring/background source');
 const cells=campaignLayout(109),centers=new Map(MAP.map((n,i)=>[id(i+1),{x:cells[n].x,y:cells[n].y}]));
 if(new Set(MAP).size!==109||new Set(source.rings.map(r=>r.id)).size!==109)throw Error('Duplicate cell or ring ID');
 const neighbor=(a,b)=>Math.abs(d(centers.get(a),centers.get(b))-92.0001)<.05;
 const burstAdjacency=[['R001','R002'],['R001','R064'],['R001','R065'],['R002','R066'],['R002','R067'],['R001','R003'],['R001','R004'],['R002','R004']];
 for(const [a,b] of burstAdjacency)if(!neighbor(a,b))throw Error('Nonadjacent required burst entrance '+a+'/'+b);
 const pairs=EDGES.split(' ').map(pair=>pair.split(':').map(Number));
 if(pairs.length!==125)throw Error('Wrong mounted rod count');
 const quotas=new Map(source.rings.map(r=>[r.id,0])),seen=new Set;
 for(const [a,b] of pairs){
  const owner=id(a),receiver=id(b),key=owner+':'+receiver;
  if(!quotas.has(owner)||!quotas.has(receiver)||owner===receiver||seen.has(key)||!neighbor(owner,receiver))
   throw Error('Invalid mounted edge '+key);
  quotas.set(owner,quotas.get(owner)+1);seen.add(key);
 }
 for(const ring of source.rings)if(quotas.get(ring.id)!==ring.ownedClaspQuota)
  throw Error('Owner quota mismatch '+ring.id);
 const backgrounds=source.backgroundPieces.map(piece=>{
  if(piece.heads!==2||piece.targetRingIds?.length!==2)throw Error('Wrong background source '+piece.id);
  const [a,b]=piece.targetRingIds.map(key=>centers.get(key));
  if(!a||!b||Math.abs(d(a,b)-92.0001)>.05)throw Error('Background endpoints are not neighbors: '+piece.id);
  const theta=angle(a,b),pa=point(a,theta,40),pb=point(b,theta+180,40);
  const anchor={x:(pa.x+pb.x)/2,y:(pa.y+pb.y)/2};
  return{id:piece.id,anchorWorld:anchor,heads:2,
   endpoints:[{id:piece.id+'-H1',receiverId:piece.targetRingIds[0],pointWorld:pa,endpointWorldAngle:theta,endpointWidth:7},
    {id:piece.id+'-H2',receiverId:piece.targetRingIds[1],pointWorld:pb,endpointWorldAngle:norm(theta+180),endpointWidth:7}],
   branchPaths:[[anchor,pa],[anchor,pb]]};
 });
 const rotations=new Map;
 for(const piece of backgrounds)for(const e of piece.endpoints)rotations.set(e.receiverId,norm(e.endpointWorldAngle+29));
 for(const [a,b] of pairs)if(!rotations.has(id(b)))
  rotations.set(id(b),norm(angle(centers.get(id(b)),centers.get(id(a)))+29));
 // The first burst is initially aligned to the incoming sleeve M003, but
 // remains held by its OWN two outgoing rods until their receiver gaps turn.
 // R004 begins 20 degrees away from M002: its short reverse move reaches
 // M002 before M004, guaranteeing R001 bursts before R002.
 // No ring starts free, and both bursts still require real player rotations.
 rotations.set('R001',angle(centers.get('R001'),centers.get('R002')));
 // A captive owner cannot freely rotate while any of its mounted receiver
 // rings remain active. Prefer an incoming clasp already aligned so that
 // preparing its outgoing receivers may free that owner without a fake move.
 // These four owners remain offset because aligning them at load caused
 // initial automatic eliminations (forbidden by the level validation gate).
 const initiallyCaptive=new Set(['R001','R074','R082','R084','R086']);
 for(const ring of source.rings){
  if(!ring.ownedClaspQuota||initiallyCaptive.has(ring.id))continue;
  const incoming=pairs.find(([,target])=>id(target)===ring.id);
  if(incoming)rotations.set(ring.id,angle(centers.get(ring.id),centers.get(id(incoming[0]))));
 }
 rotations.set('R004',norm(angle(centers.get('R004'),centers.get('R001'))+20));
 const points=source.rings.map(r=>{const c=centers.get(r.id);return[r.id,c.x,c.y,rotations.get(r.id)??147]});
 const mountedRods=pairs.map(([a,b],i)=>{
  const owner=centers.get(id(a)),receiver=centers.get(id(b));
  const theta=angle(owner,receiver),p=point(owner,theta,40),q=point(receiver,theta+180,40);
  const initial=rotations.get(id(a))??147;
  return{id:'M'+String(i+1).padStart(3,'0'),owner:id(a),targets:[id(b)],
   local:rot({x:p.x-owner.x,y:p.y-owner.y},-initial),
   end:rot({x:q.x-owner.x,y:q.y-owner.y},-initial)};
 });
 const allCovered=source.rings.every(r=>r.ownedClaspQuota||backgrounds.some(p=>p.endpoints.some(e=>e.receiverId===r.id))||pairs.some(([,b])=>id(b)===r.id));
 if(!allCovered)throw Error('Some initial rings are disconnected');
 const incoming=new Map(source.rings.map(r=>[r.id,0]));
 for(const [,b] of pairs)incoming.set(id(b),incoming.get(id(b))+1);
 const diagnostics={stage:'geometry_candidate_only',sourceLevel:107,
  releaseReady:false,physicalRouteVerified:false,mountedRods:mountedRods.length,
  backgroundPieces:backgrounds.length,backgroundEnds:backgrounds.length*2,
  receiverGraphAuthoritative:false,requiredAdjacency:burstAdjacency,
  multipleMountedReceivers:[...incoming].filter(([,count])=>count>1).map(([ring,count])=>({ring,count}))};
 return{level:{name:'第107关（未验证布局候选）',kind:'development-only',
  tip:'研发候选，禁止发布',points,links:[],mountedRods,backgroundPieces:backgrounds,
  special:{rings:source.rings.map(r=>({id:r.id,attribute:r.attribute==='仅爆裂'?'burst':'ordinary',silkLayers:0})),silkEdges:[]}},
  diagnostics};
}