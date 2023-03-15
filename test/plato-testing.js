var plato = require('plato');

var files = [
  '/Users/cindychen/Documents/CMU/17313/spring23-nodebb-team-c1/src/topics/create.js',
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