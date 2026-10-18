const fs = require('fs');
const content = fs.readFileSync('d:/PROJECT AI/PrjNewMenu/standalone_demo.html', 'utf8');

// just extract the object inside window.CostStructure = function() { ... return { ... } }
// and see if it parses
