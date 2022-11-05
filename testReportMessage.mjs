import config from './jest.config.mjs';
console.log(`Check out file:///${process.cwd().replace(/\\/g, '/')}/${config.reporters[1][1].resultDir}/index.html for HTML report.`);