#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const tree = resolve(root, 'contract/provider-request-1.1');
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
assert.equal(hash(resolve(root,'contract/provider-request-1.1.lock.json')), '9fad71c6bc2497221c49d33d6df00ceda2c335b7598791391ed38286bf0b3641', 'readiness lock drift');
const lock = read(resolve(root,'contract/provider-request-1.1.lock.json'));
assert.equal(lock.contractVersion,'1.1.0');
assert.equal(lock.canonicalCommit,'e19875d0d6e74b5d990e45e456656c99dacc89d1');
assert.equal(lock.backendCommit,'48485a55773b1ca97e165a4715d343704270266e');
assert.equal(lock.sourcePR,44); assert.equal(lock.backendPR,45);
const expected = ['scripts/plugin-contract.mjs','scripts/provider-request-contract.mjs','docs/plugin-contract/v1.1/provider-requests.json','docs/plugin-contract/v1.1/conformance.json','docs/plugin-contract/v1.1/skills.lock.json','plugins/htp/skills/repository-settings/SKILL.md','plugins/htp/skills/seo-review/SKILL.md','plugins/htp/skills/seo-review/references/data.md','plugins/htp/skills/website-management/SKILL.md'].sort();
assert.deepEqual(Object.keys(lock.files).sort(),expected);
const files = dir => readdirSync(dir,{withFileTypes:true}).flatMap(d => d.isDirectory() ? files(resolve(dir,d.name)) : [relative(tree,resolve(dir,d.name))]);
assert.deepEqual(files(tree).sort(),expected,'snapshot inventory drift');
for (const p of expected) assert.equal(hash(resolve(tree,p)),lock.files[p],`snapshot drift: ${p}`);
const {profile, validateProviderResults} = await import('../contract/provider-request-1.1/scripts/provider-request-contract.mjs');
const skills=read(resolve(tree,'docs/plugin-contract/v1.1/skills.lock.json'));
assert.equal(skills.contractVersion,profile.contractVersion);
const actual=files(resolve(tree,'plugins/htp/skills')).sort();
assert.deepEqual(skills.files.map(f=>f.path).sort(),actual);
for (const f of skills.files) {
 assert.equal(hash(resolve(tree,f.path)),f.sha256,`source lock drift: ${f.path}`);
 assert.equal(hash(resolve(root,f.path)),f.sha256,`shipped skill drift: ${f.path}`);
}
const shipped = dir => readdirSync(dir,{withFileTypes:true}).flatMap(d => d.isDirectory()?shipped(resolve(dir,d.name)):[relative(root,resolve(dir,d.name))]);
assert.deepEqual(shipped(resolve(root,'plugins/htp/skills')).sort(),actual,'shipped inventory drift');
const fixtures=read(resolve(tree,'docs/plugin-contract/v1.1/conformance.json'));
validateProviderResults(fixtures,{contractVersion:'1.1.0',host:'claude',observations:fixtures.scenarios.map(s=>({id:s.id,steps:s.steps.map(t=>t.expected)}))});
const args=process.argv.slice(2);
if(args.length){
 assert.ok(args.length===2 && args[0]==='--provider-results','usage: node scripts/check-provider-request-readiness.mjs [--provider-results file]');
 const result=read(resolve(args[1])); assert.equal(result.host,'claude','host must be claude'); validateProviderResults(fixtures,result);
 console.log(result.observations.every(o=>Object.hasOwn(o,'context'))?'Measured context supplied for all provider traces; evidence provenance remains an independent acceptance obligation.':'Synthetic fixture context selected; this is not measured backend/host acceptance.');
 console.log('Provider semantic trace assertions passed. Counters/context require independent measured evidence; provenance and live support are not verified.');
}
console.log(`Provider profile ${profile.contractVersion}: ${fixtures.scenarios.length} synthetic lifecycle traces; implementation/release gates remain open.`);
