const fs=require('fs');const src=f=>fs.readFileSync(__dirname+'/src/'+f,'utf8');
const code=['data.js','map.js','scenarios.js','tutorial.js','balance.js','commanders.js','guidance.js','sim.js','assess.js','models.js','render.js','render2.js','render3.js','sound.js','ui.js'].map(src).join('\n');
const tpl=src('index.tpl.html');
const out=(three,pre)=>tpl.replace('<!--THREE-->',three).replace('/*CODE*/',()=> (pre||'')+code);
fs.writeFileSync(__dirname+'/dist/index.html',out('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'));
fs.writeFileSync(__dirname+'/dist/test.html',out('<script>'+fs.readFileSync(__dirname+'/node_modules/three/build/three.min.js','utf8').replace(/<\/script>/g,'<\\/script>')+'</script>','/*PRE*/'));
console.log('built',(fs.statSync(__dirname+'/dist/index.html').size/1024|0)+' KB');
