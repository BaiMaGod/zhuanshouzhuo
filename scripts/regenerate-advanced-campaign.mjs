#!/usr/bin/env node
// Rebuild advanced campaign levels 131-145 from the approved design specification.
// Every generated level is validated and physically replayed by generateAdvancedLevel.
import {readFileSync,writeFileSync} from 'node:fs';
import Core from '../src/core.js';
import {campaignLayout} from '../src/campaign-layout.js';
import {generateAdvancedLevel} from './generate-advanced-campaign.mjs';

const design=JSON.parse(readFileSync(new URL('../docs/levels-101-200-design.json',import.meta.url),'utf8'));
const createCore=level=>{
 const index=Core.levels.push(level)-1;
 return{...Core,make:()=>Core.make(index)};
};
for(let number=131;number<=145;number++){
 const result=generateAdvancedLevel(number,{design,campaignLayout,createCore});
 const data={levels:[result.level],solutions:[result.solution],stats:[result.stats]};
 const path=new URL('../data/advanced-campaign-'+number+'.json',import.meta.url);
 writeFileSync(path,JSON.stringify(data,null,2)+'\n');
 console.log('Generated and physically replayed level '+number+' | heads '+JSON.stringify(result.stats.headCounts)+' | steps '+result.stats.routeSteps);
}
const bundles=[
 {start:130,end:133,path:'../src/advanced-campaign-130-133.js',name:'advancedCampaign130133'},
 {start:134,end:137,path:'../src/advanced-campaign-134-137.js',name:'advancedCampaign134137'},
 {start:138,end:141,path:'../src/advanced-campaign-138-141.js',name:'advancedCampaign138141'},
 {start:142,end:145,path:'../src/advanced-campaign-142-145.js',name:'advancedCampaign142145'}
];
for(const bundle of bundles){
 const entries=[];
 for(let number=bundle.start;number<=bundle.end;number++){
  const data=JSON.parse(readFileSync(new URL('../data/advanced-campaign-'+number+'.json',import.meta.url),'utf8'));
  entries.push({level:data.levels[0],solution:data.solutions[0]});
 }
 const source='// Generated runtime campaign data for levels '+bundle.start+'-'+bundle.end+'.\n'+
  'export const '+bundle.name+'='+JSON.stringify(entries)+';\n';
 writeFileSync(new URL(bundle.path,import.meta.url),source);
 console.log('Updated runtime bundle '+bundle.start+'-'+bundle.end);
}
