'use strict';

const plato = require('es6-plato');

const files = [
    './src/topics/create.js',
    './src/topics/*.js',
    './src/topics/*.ts',
];
const outputDir = './output/dir';

const platoArgs = {
    title: 'Plato Report',
    eslint: {},
};
function callback(reports) {
    const overview = plato.getOverviewReport(reports);

    const { total, average } = overview.summary;

    const output = `total
        ----------------------
        eslint: ${total.eslint}
        sloc: ${total.sloc}
        maintainability: ${total.maintainability}
        average
        ----------------------
        eslint: ${average.eslint}
        sloc: ${average.sloc}
        maintainability: ${average.maintainability}`;

    console.log(output);
}
plato.inspect(files, outputDir, platoArgs, callback);
