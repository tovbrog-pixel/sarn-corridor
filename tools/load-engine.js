// Loads the simulation engine files into one sandbox and returns { createSim, SCENARIOS }.
const fs = require('fs'), vm = require('vm'), path = require('path');
module.exports = function loadEngine(dir) {
  dir = dir || path.join(__dirname, '..', 'engine', 'src');
  const files = ['data.js', 'divisions.js', 'map.js', 'scenarios.js', 'tutorial.js', 'balance.js', 'commanders.js', 'guidance.js', 'sim.js', 'command.js', 'transport.js', 'air.js', 'politics.js', 'theater.js', 'replace.js', 'doctrine.js', 'assess.js'];
  const code = files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') + '\n;this.__api = { createSim, SCENARIOS, attachCommand, attachTransport, attachAir, attachPolitics, attachTheater, attachRepl, attachDoctrine, divForm, DIVTPL };';
  const ctx = { console, Math, Date, JSON, Object, Array, Uint8Array, Int16Array, Float32Array, Int32Array, Uint16Array, Map, Set, Error, Number, String, Boolean, RegExp, Infinity, NaN, isFinite, parseFloat, parseInt, performance };
  vm.createContext(ctx); vm.runInContext(code, ctx, { filename: 'engine.js' });
  return ctx.__api;
};
