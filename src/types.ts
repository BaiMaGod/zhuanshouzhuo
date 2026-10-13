export interface Ring { id:string; x:number; y:number; a:number; life:'active'|'removed'; color:string }
export interface Point {x:number;y:number}
export interface Rod {id:string; kind:'m'|'b'; owner?:string; targets:string[];local?:Point;end?:Point;p?:Point;q?:Point}
export interface State {index:number;rings:Ring[];rods:Rod[];steps:number;states:Record<string,('latched'|'aligned'|'inactive')[]>;events:unknown[]}
export interface Action {id:string;delta:number;rod:string}
export interface Block {kind:string;rod:string;target:string;text:string}
export interface Result {done:number;removed:string[];blocked:Block|null}
export interface CoreAPI {
 R:number;BAND:number;GAP:number;END:number;D:number;tolerance:number;
 levels:{name:string;tip:string;kind?:'formal';points:unknown[];links:unknown[]}[];
 norm(a:number):number;diff(a:number,b:number):number;
 clone<T>(x:T):T;dist(a:Point,b:Point):number;angle(a:Point,b:Point):number;
 point(p:Point,a:number,d?:number):Point;rot(p:Point,a:number):Point;
 make(i:number):State;ring(s:State,id:string):Ring|undefined;
 pose(s:State,z:Rod):{p:Point;q:Point};exists(s:State,z:Rod):boolean;
 endpoints(s:State,z:Rod):{id:string;p:Point}[];
 connections(s:State,id:string):unknown[];
 update(s:State):void;settle(s:State):string[];
 request(s:State,id:string,delta:number):Result;
 candidates(s:State):Action[];solve(s:State,budget?:number):{path:Action[]|null;visited:number};
 validate(s:State):string[];blockage(s:State,id:string):Block|null;
}

