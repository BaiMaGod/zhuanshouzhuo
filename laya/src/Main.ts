import {boot} from './bracelet/main.js';
const {regClass}=Laya;
@regClass()
export class Main extends Laya.Script {
 onStart():void{void boot().catch(e=>console.error('Game startup failed',e))}
}
