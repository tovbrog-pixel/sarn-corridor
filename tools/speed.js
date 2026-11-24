// Headless speed test: runs each scenario AI-vs-AI with no graphics.
// Usage: node tools/speed.js engine/src
const fs=require('fs'),vm=require('vm');const dir=process.argv[2]||'engine/src';
const code=['data.js','map.js','scenarios.js','tutorial.js','balance.js','commanders.js','guidance.js','sim.js','assess.js'].map(f=>fs.readFileSync(dir+'/'+f,'utf8')).join('\n')+'\n;this.__api={createSim,SCENARIOS};';
const ctx={console,Math,Date,JSON,Object,Array,Uint8Array,Int16Array,Float32Array,Int32Array,Uint16Array,Map,Set,Error,Number,String,Boolean,RegExp,Infinity,NaN,isFinite,parseFloat,parseInt};vm.createContext(ctx);vm.runInContext(code,ctx);
const {createSim,SCENARIOS}=ctx.__api;
const list=Array.isArray(SCENARIOS)?SCENARIOS:Object.values(SCENARIOS);
for(const sc of list){ if(!sc||!sc.sides)continue;
  const t0=Date.now(); const S=createSim(sc,-1,12345,{}); S.setup&&S.setup(); const tSetup=Date.now()-t0;
  const hours=sc.hours||48; const t1=Date.now(); let g=0; while(!S.over&&g<hours*60){S.advance(60);g+=60;} const ms=Date.now()-t1;
  const subs=S.subs.filter(u=>u.active&&!u.dead).length;
  console.log(`${(sc.id||sc.name||'?').toString().padEnd(14)} map ${sc.w}x${sc.h} km  forms ${S.forms.length}  units ${subs}  game ${(g/60).toFixed(0)} h in ${(ms/1000).toFixed(1)} s  = ${Math.round(g*60/(ms/1000))}x real time  (setup ${tSetup} ms)`);
}
