// Contract fixture only. It does not claim to be an AI model or external integration.
import {createServer} from 'node:http';
const server=createServer((request,response)=>{
  if(request.url==='/ready'){response.end('ready');return;}
  if(request.headers.authorization!=='Bearer browser-contract-fixture'){response.writeHead(401);response.end();return;}
  if(request.url==='/v1/models') {response.setHeader('Content-Type','application/json');response.end(JSON.stringify({data:[{id:'fixture/coder'}]}));return;}
  if(request.url!=='/v1/chat/completions'){response.writeHead(404);response.end();return;}
  let body='';request.on('data',chunk=>{body+=chunk;if(body.length>1000000)request.destroy();});
  request.on('end',()=>{
    try {
      const input=JSON.parse(body);
      if(input.model!=='fixture/coder'){response.writeHead(400);response.end();return;}
      response.writeHead(200,{'Content-Type':'text/event-stream'});
      const projectRequest=input.messages?.some(message=>message.role==='system'&&message.content.includes('editing a real React project'));
      const invalid=JSON.stringify(input.messages).includes('FIXTURE_INVALID');
      const text=projectRequest ? (invalid ? '<file path="src/App.jsx">export default function ( BROKEN </file>' : '<file path="src/App.jsx">export default function App(){return <h1 className="p-8">Proposta compilada</h1>}</file>Proposta de teste.') : 'READY';
      const chunk={id:'browser-fixture',created:1,model:input.model,object:'chat.completion.chunk',choices:[{index:0,delta:{content:text},finish_reason:null}]};
      response.write(`data: ${JSON.stringify(chunk)}\n\n`);
      response.end(`data: ${JSON.stringify({...chunk,choices:[{index:0,delta:{},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`);
    } catch {response.writeHead(400);response.end();}
  });
});
server.listen(3101,'127.0.0.1');
