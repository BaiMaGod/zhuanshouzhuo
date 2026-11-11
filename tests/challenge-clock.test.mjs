import test from 'node:test';
import assert from 'node:assert/strict';
import {ChallengeClock} from '../dist/js/challenge-clock.js';
test('计时从第一次主动操作起算，设置/道具弹窗重叠暂停不会多扣时间',()=>{
 const c=new ChallengeClock(10);
 assert.equal(c.remainingMs(1000),10000);
 c.begin(2000);
 c.pause('settings',3000);
 c.pause('item',4000);
 c.resume('settings',5500);
 assert.equal(c.remainingMs(7000),9000);
 c.resume('item',8000);
 assert.equal(c.remainingMs(9000),8000);
});
test('恰好截止时逻辑解除通过，而动画时间不会导致后续失败',()=>{
 const c=new ChallengeClock(10);c.begin(0);
 assert.equal(c.clearAt(9999),true);
 assert.equal(c.timeOut(20000),false);
 const another=new ChallengeClock(10);another.begin(0);
 assert.equal(another.clearAt(10000),true);
 assert.equal(another.timeOut(10001),false);
 const late=new ChallengeClock(10);late.begin(0);
 assert.equal(late.clearAt(10000.1),false);
 assert.equal(late.timeOut(10001),true);
});
test('超时不能继续操作，重试使用新时钟而不是失败前余量',()=>{
 const c=new ChallengeClock(5);c.begin(1000);
 assert.equal(c.timeOut(6001),true);
 assert.equal(c.clearAt(6002),false);
 const retry=new ChallengeClock(5);
 assert.equal(retry.remainingMs(20000),5000);
});
test('存档恢复维持已有耗时与已判定状态',()=>{
 const c=new ChallengeClock(15);c.begin(1000);
 const snap=c.snapshot(6000);
 const restored=new ChallengeClock(15,snap);
 assert.equal(restored.remainingMs(20000),10000);
 restored.begin(21000);assert.equal(restored.remainingMs(23000),7000);
});

test('截止同一时间戳先触发超时回调，再结算逻辑解除仍然可通关',()=>{
 const c=new ChallengeClock(5);c.begin(0);
 assert.equal(c.timeOut(5000),true);
 assert.equal(c.clearAt(5000),true);
 assert.equal(c.result,'won');
 assert.equal(c.timeOut(5001),false);
});

test('截止帧未消除时，后续帧及恢复失败存档均不能改判通关',()=>{
 const c=new ChallengeClock(5);c.begin(0);
 assert.equal(c.timeOut(5000),true);
 assert.equal(c.clearAt(5001),false);
 assert.equal(new ChallengeClock(5,c.snapshot(5001)).clearAt(1),false);
});
