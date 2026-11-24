// Prepares app/ for the desktop shell: the game page (app/index.html, the Overlord slice and the engine's scenarios, opening on the
// scenario menu), plus the engine files and three.js that the technical test (app/techtest.html) loads.
// Run from the repository root: node tools/build-app.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const engineFiles = ['data.js', 'divisions.js', 'map.js', 'scenarios.js', 'tutorial.js', 'balance.js', 'commanders.js', 'guidance.js', 'sim.js', 'command.js', 'transport.js', 'air.js', 'politics.js', 'theater.js', 'replace.js', 'assess.js'];
const outEngine = path.join(root, 'app', 'engine'), outVendor = path.join(root, 'app', 'vendor');
fs.mkdirSync(outEngine, { recursive: true }); fs.mkdirSync(outVendor, { recursive: true });
for (const f of engineFiles) fs.copyFileSync(path.join(root, 'engine', 'src', f), path.join(outEngine, f));
fs.copyFileSync(path.join(root, 'node_modules', 'three', 'build', 'three.min.js'), path.join(outVendor, 'three.min.js'));
require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'build-preview.js'), path.join(root, 'app'), 'overlord', 'menu'], { stdio: 'inherit' });
console.log('app/ prepared: the game page, ' + engineFiles.length + ' engine files and three.min.js');
