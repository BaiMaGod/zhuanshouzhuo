import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';

installHarness();
const [{Save},{Core}]=await Promise.all([
 import('../dist/js/storage.js'),
 import('../dist/js/model.js')
]);

test('brand-new local player starts tutorial exactly once, even after returning home',()=>{
 const key='onboarding-new-player',save=new Save(key);
 assert.equal(save.shouldAutoStartTutorial(),true);
 save.markTutorialOpened();
 assert.equal(save.shouldAutoStartTutorial(),false);
 assert.equal(new Save(key).shouldAutoStartTutorial(),false,'marker survives relaunch');
});

test('existing completed and in-progress players never enter forced tutorial',()=>{
 const completed=new Save('onboarding-completed');
 completed.win(0,1,1);
 assert.equal(new Save('onboarding-completed').shouldAutoStartTutorial(),false);
 const guideSeen=new Save('onboarding-guide');
 guideSeen.data.tutorial=1;guideSeen.persist();
 assert.equal(new Save('onboarding-guide').shouldAutoStartTutorial(),false);
 const formal=new Save('onboarding-formal-run');
 formal.writeRun(10,Core.make(10),1,1);
 assert.equal(new Save('onboarding-formal-run').shouldAutoStartTutorial(),false);
});

test('first tutorial launch marker is isolated across save identities',()=>{
 const local=new Save('onboarding-local'),account=new Save('onboarding-account');
 local.markTutorialOpened();
 assert.equal(local.shouldAutoStartTutorial(),false);
 assert.equal(account.shouldAutoStartTutorial(),true);
});
