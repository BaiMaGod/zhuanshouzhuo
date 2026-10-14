import ImportedCore from './core.js';
import type {CoreAPI,State} from './types.js';
import {formalHint} from './hint-route.js';
const C=ImportedCore as unknown as CoreAPI;
self.onmessage=(e:MessageEvent<State>)=>{
 try {
  if(e.data.index===10){const hint=formalHint(e.data);self.postMessage({path:hint?[hint]:null,visited:0})}
  else self.postMessage(C.solve(e.data,600));
 }
 catch { self.postMessage({path:null,visited:0}); }
};
