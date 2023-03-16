var plato = require('plato');

var files = [
  './src/topics/create.js',
  './src/topics/*.js',
  './src/topics/*.ts',
];

var outputDir = './output/dir';
// null options for this example
var options = {
  title: 'Plato Report'
};

var callback = function (report){
// once done the analysis,
// execute this
};

plato.inspect(files, outputDir, options, callback);