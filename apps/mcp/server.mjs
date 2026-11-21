import { createInterface } from 'node:readline';
import { load } from '../../packages/providers/demo.mjs';
import { analyze } from '../../packages/analysis/index.mjs';

const handlers={get_league_snapshot:load,preview_recommendations:()=>analyze(load())};
const tools=Object.keys(handlers).map(name=>({
  name,description:name==='get_league_snapshot'?'Read the fictional demo league.':'Preview lineup and trade recommendations.',
  inputSchema:{type:'object',properties:{},additionalProperties:false},
  annotations:{readOnlyHint:true,openWorldHint:false}
}));
const supported=['2024-11-05','2025-03-26','2025-06-18','2025-11-25'];
for await (const line of createInterface({input:process.stdin})) {
  let id=null;
  try {
    const request=JSON.parse(line);
    if (!Object.hasOwn(request,'id')) continue;
    id=request.id;
    const {method,params}=request;
    let result;
    if (method==='initialize') result={
      protocolVersion:supported.includes(params?.protocolVersion)?params.protocolVersion:supported.at(-1),
      capabilities:{tools:{}},serverInfo:{name:'fantasy-roster-workbench',version:'0.1.0'}
    };
    else if(method==='ping') result={};
    else if(method==='tools/list') result={tools};
    else if(method==='tools/call' && tools.some(tool=>tool.name===params?.name) && !Object.keys(params.arguments??{}).length) {
      result={content:[{type:'text',text:JSON.stringify(handlers[params.name]())}]};
    } else {
      console.log(JSON.stringify({jsonrpc:'2.0',id,error:{code:method==='tools/call'?-32602:-32601,message:'Unsupported request.'}}));
      continue;
    }
    console.log(JSON.stringify({jsonrpc:'2.0',id,result}));
  } catch(error) {
    console.log(JSON.stringify({jsonrpc:'2.0',id,error:{code:id===null?-32700:-32603,message:error.message}}));
  }
}
