// Permanent sign-in grants and inventory spends. This domain is deliberately
// separate from per-level rewarded video/share entitlements.
export type InventoryKind='hint'|'erase';
export interface DailyReward {hint:number;erase:number}
export const DAILY_REWARDS:readonly DailyReward[]=[
 {hint:1,erase:0},{hint:1,erase:0},{hint:0,erase:1},
 {hint:1,erase:0},{hint:2,erase:0},{hint:1,erase:0},{hint:1,erase:1}
];
export interface InventorySpend {kind:InventoryKind;at:number;level:number}
export interface Economy {
 version:1;
 // A date key has at most one claim. The day/cycle and granted rewards are
 // derived from the sorted unique dates, so device merges cannot double-grant.
 claims:Record<string,1>;
 spends:Record<string,InventorySpend>;
}
export interface DailyStatus {
 dateKey:string;claimedToday:boolean;completed:number;todaySlot:number;
 nextReward:DailyReward;totalDays:number;clockInvalid:boolean;
}
export const emptyEconomy=():Economy=>({version:1,claims:{},spends:{}});
const kinds:InventoryKind[]=['hint','erase'];
function validDateKey(value:string):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const stamp=Date.parse(value+'T00:00:00Z');
 return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value;
}
export function chinaDateKey(now=Date.now()):string{
 if(!Number.isFinite(now))throw Error('Invalid clock');
 return new Date(now+8*60*60*1000).toISOString().slice(0,10);
}
export function validateEconomy(value:unknown):Economy{
 if(value===undefined||value===null)return emptyEconomy(); // older saves
 const e=value as Economy;
 if(!e||e.version!==1||!e.claims||typeof e.claims!=='object'||Array.isArray(e.claims)||!e.spends||typeof e.spends!=='object'||Array.isArray(e.spends))throw Error('Invalid inventory');
 const claims:Record<string,1>={};
 for(const [date,flag] of Object.entries(e.claims)){
  if(!validDateKey(date)||flag!==1||Object.keys(claims).length>=10000)throw Error('Invalid sign-in');
  claims[date]=1;
 }
 const spends:Record<string,InventorySpend>={};
 for(const [id,v] of Object.entries(e.spends)){
  if(!/^tool:[A-Za-z0-9-]{8,120}$/.test(id)||Object.keys(spends).length>=50000||!v||!kinds.includes(v.kind)||!Number.isSafeInteger(v.at)||v.at<0||!Number.isInteger(v.level)||v.level<0||v.level>1000)throw Error('Invalid inventory spend');
  spends[id]={kind:v.kind,at:v.at,level:v.level};
 }
 return {version:1,claims,spends};
}
export function claimDates(e:Economy):string[]{return Object.keys(e.claims).sort()}
export function rewardForDay(day:number):DailyReward{
 if(!Number.isSafeInteger(day)||day<1||day>7)throw Error('Invalid sign-in day');
 return DAILY_REWARDS[day-1]!;
}
export function dailyStatus(e:Economy,now=Date.now()):DailyStatus{
 const dateKey=chinaDateKey(now),dates=claimDates(e),claimedToday=!!e.claims[dateKey];
 const totalDays=dates.length,latest=dates.at(-1);
 const completed=claimedToday?(totalDays-1)%7+1:totalDays%7;
 const todaySlot=claimedToday?completed:completed+1;
 return {dateKey,claimedToday,completed,todaySlot,
  nextReward:rewardForDay(todaySlot),totalDays,clockInvalid:!!latest&&latest>dateKey};
}
export function claimToday(e:Economy,now=Date.now()):{ok:boolean;status:DailyStatus;reward:DailyReward}{
 const status=dailyStatus(e,now);
 if(status.claimedToday||status.clockInvalid)return {ok:false,status,reward:status.nextReward};
 e.claims[status.dateKey]=1;
 return {ok:true,status:dailyStatus(e,now),reward:status.nextReward};
}
export function inventoryBalance(e:Economy,kind:InventoryKind):number{
 let granted=0;
 // Sign-in reward order is canonical across merged devices.
 const dates=claimDates(e);
 for(let i=0;i<dates.length;i++)granted+=DAILY_REWARDS[i%7]![kind];
 let used=0;
 for(const event of Object.values(e.spends))if(event.kind===kind)used++;
 return Math.max(0,granted-used);
}
export function spendInventory(e:Economy,kind:InventoryKind,level:number,now=Date.now()):boolean{
 if(!kinds.includes(kind)||!Number.isInteger(level)||level<0||inventoryBalance(e,kind)<=0)return false;
 const guid=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
 const id='tool:'+guid;
 if(e.spends[id])return false;
 e.spends[id]={kind,at:Math.max(0,Math.trunc(now)),level};
 return true;
}
export function mergeEconomy(a:Economy,b:Economy):Economy{
 const claims={...a.claims,...b.claims};
 const spends={...a.spends};
 for(const [id,v] of Object.entries(b.spends)){
  const old=spends[id];
  if(!old||JSON.stringify(v)<JSON.stringify(old))spends[id]=v;
 }
 return validateEconomy({version:1,claims,spends});
}
