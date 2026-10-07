// Exercise each edge handler without a network, provider key, or real booking.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
for (const name of ['cal-book','cal-cancel','calendly-book','calendly-cancel']) {
  const source=fs.readFileSync(`supabase/functions/${name}/index.ts`,'utf8').replace(/^import .*;\s*$/gm,'');
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  let handler;
  vm.runInNewContext(code,{serve:fn=>handler=fn,Deno:{env:{get:key=>key==='SUPABASE_SERVICE_ROLE_KEY'?'server-only':undefined}},Response,Request,console,fetch:()=>{throw Error('Unexpected network call')}});
  for (const auth of [null,'Bearer public-key','Bearer customer-jwt']) {
    const response=await handler(new Request('https://example.com',{method:'POST',headers:auth?{authorization:auth}:{},body:'{}'}));
    assert.equal(response.status,403,`${name}: client access denied`);
  }
  assert.equal((await handler(new Request('https://example.com',{method:'POST',headers:{authorization:'Bearer server-only'},body:'{}'}))).status,503);
  console.log(`PASS ${name}: customer mutations denied; trusted backend passes auth`);
}
