'use strict';
// New additive call site only. Existing checks, npm scripts and workflows remain unchanged.
const path = require('node:path');
const {validateDevelopmentGradle} = require('./check-mobile-development-gradle.cjs');
const {validateDevelopmentPreservation} = require('./check-mobile-development-preservation.cjs');
function main(args = process.argv.slice(2)) {
  const options = {};
  const flags = new Set(['--workspace','--registry-sha256','--contract-sha256','--profile']);
  for (let i=0;i<args.length;i++) {
    if (args[i] === '--review-only') { options.reviewOnly=true; continue; }
    if (!flags.has(args[i]) || i+1 === args.length || options[args[i]]) throw Error('Unknown, duplicate or incomplete option');
    options[args[i]]=args[++i];
  }
  if (!options['--profile']) throw Error('An explicit development profile is required');
  const authorityRoot=path.resolve(__dirname,'..');
  const workspaceRoot=options['--workspace']?path.resolve(options['--workspace']):authorityRoot;
  const common={workspaceRoot,authorityRoot,reviewOnly:options.reviewOnly===true};
  const gradle=validateDevelopmentGradle({...common,expectedRegistrySha256:options['--registry-sha256'],profileId:options['--profile'],purpose:'development-validation'});
  const preservation=validateDevelopmentPreservation({...common,expectedContractSha256:options['--contract-sha256']});
  console.log(JSON.stringify({gradle,preservation,productionQualified:false},null,2));
}
module.exports={main};
if(require.main===module){try{main();}catch(error){console.error(error.message);process.exitCode=1;}}
