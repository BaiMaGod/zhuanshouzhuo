import ImportedCore from './core.js';
import type {CoreAPI,State} from './types.js';
const C=ImportedCore as unknown as CoreAPI;
self.onmessage=(e:MessageEvent<State>)=>{
 try { self.postMessage(C.solve(e.data,600)); }
 catch { self.postMessage({path:null,visited:0}); }
};
