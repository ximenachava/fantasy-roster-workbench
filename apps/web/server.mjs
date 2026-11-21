import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { analyze, decide, queue } from '../../packages/analysis/index.mjs';
import { fresh, load, save } from '../../packages/providers/demo.mjs';

const port = Number(process.env.PORT || 4173);
const origin = 'http://127.0.0.1:' + port;
const assets = new Map([['/',['index.html','text/html']],['/style.css',['style.css','text/css']],['/app.js',['app.js','text/javascript']]]);
function json(res, status, body) {
  res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});
  res.end(JSON.stringify(body));
}
export async function handleRequest(req,res) {
  try {
    if (req.headers.host !== '127.0.0.1:'+port) return json(res,403,{error:'Use the loopback address shown at startup.'});
    if (req.method==='GET' && assets.has(req.url)) {
      const [name,type]=assets.get(req.url);
      res.writeHead(200,{'content-type':type+'; charset=utf-8','x-content-type-options':'nosniff'});
      return res.end(readFileSync(new URL(name,import.meta.url)));
    }
    if (req.method==='GET' && req.url==='/api/league') {
      const league=load();
      return json(res,200,{league,suggestions:analyze(league)});
    }
    if (req.method!=='POST' || !['/api/analyze','/api/decision','/api/reset'].includes(req.url)) {
      return json(res,404,{error:'Route not found.'});
    }
    if (req.headers.origin!==origin || req.headers['content-type']!=='application/json') {
      return json(res,403,{error:'Use the local dashboard to submit changes.'});
    }
    let body='';
    for await (const chunk of req) {
      body += chunk;
      if (body.length>8192) return json(res,413,{error:'Request too large.'});
    }
    const payload=JSON.parse(body || '{}');
    const league=req.url==='/api/reset' ? fresh() : load();
    if(req.url==='/api/analyze') queue(league);
    if(req.url==='/api/decision') decide(league,payload.id,payload.action);
    save(league);
    return json(res,200,{league,suggestions:analyze(league)});
  } catch(error) {
    return json(res,400,{error:error.message});
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  createServer(handleRequest).listen(port,'127.0.0.1',()=>console.log('Fantasy Roster Workbench running at '+origin));
}
