import {mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve(new URL('..',import.meta.url).pathname), tmp=mkdtempSync(join(tmpdir(),'claude-readiness-'));
try {
 for(const p of ['scripts','contract','plugins']) cpSync(join(root,p),join(tmp,p),{recursive:true});
 const fixtures=JSON.parse(readFileSync(join(tmp,'contract/provider-request-1.1/docs/plugin-contract/v1.1/conformance.json')));
 const result={contractVersion:'1.1.0',host:'claude',observations:fixtures.scenarios.map(s=>({id:s.id,context:{evidenceRefs:['fixture://measured-context-example'],steps:s.steps.map(t=>({id:t.id,now:t.now,request:t.request,association:t.association,...(t.workBefore?{workBefore:t.workBefore}:{}),...(t.committedAfterLoss?{committedAfterLoss:t.committedAfterLoss}:{})}))},steps:s.steps.map(t=>t.expected)}))};
 const rollover=result.observations.find(o=>o.id==='bing.rollover.omitted_dates'); rollover.context.steps[2].now=rollover.context.steps[1].now;
 const path=join(tmp,'results.json'); const run=(args=[])=>spawnSync(process.execPath,[join(tmp,'scripts/check-provider-request-readiness.mjs'),...args],{encoding:'utf8'});
 const save=()=>writeFileSync(path,JSON.stringify(result)); save(); let r=run(['--provider-results',path]); assert.equal(r.status,0,r.stderr); assert.match(r.stdout,/Measured context/);
 const json=JSON.stringify(result); const limit=1024*1024; assert.ok(Buffer.byteLength(json)<limit);
 writeFileSync(path,json+' '.repeat(limit-Buffer.byteLength(json))); r=run(['--provider-results',path]); assert.equal(r.status,0,r.stderr);
 writeFileSync(path,json+' '.repeat(limit+1-Buffer.byteLength(json))); r=run(['--provider-results',path]); assert.notEqual(r.status,0); assert.match(r.stderr,/JSON input exceeds 1 MiB/);
 const invalid=result.observations.flatMap(o=>o.context.steps).find(s=>s.request.requestKey===''); assert.ok(invalid); invalid.request.requestKey='valid-key'; save(); assert.notEqual(run(['--provider-results',path]).status,0); invalid.request.requestKey='';
 result.host='pi'; save(); assert.notEqual(run(['--provider-results',path]).status,0); result.host='claude';
 delete result.observations[0].context; save(); assert.notEqual(run(['--provider-results',path]).status,0);
 const f=join(tmp,'plugins/htp/skills/website-management/SKILL.md'); writeFileSync(f,readFileSync(f,'utf8')+'\ndrift\n'); assert.notEqual(run().status,0);
 console.log('measured-context CLI, wrong-host, partial-context and shipped drift checks passed');
} finally {rmSync(tmp,{recursive:true,force:true});}
