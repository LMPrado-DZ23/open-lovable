import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {projectStore} from '../lib/projects/store';
import {safeLogger} from '../lib/security/secret-content';
import {RunQueue} from '../lib/runs/queue';
import {runWorkerOnce} from '../lib/runs/worker';
import {authMode} from '../lib/identity/config';

/** Local operator process. It has no public HTTP or arbitrary shell-execution interface. */
async function main():Promise<void>{
 if(process.argv.slice(2).some(arg=>arg!=='--once'))throw new Error('Usage: worker [--once]');
 const queue=new RunQueue(projectStore()),lease=queue.acquireWorker(randomUUID());
 if(!lease)throw new Error('Another worker holds the execution lease for this installation.');
 const stop=new AbortController(),shutdown=()=>stop.abort();process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
 const onMessage=(message:unknown)=>{if(message&&typeof message==='object'&&(message as {type?:unknown}).type==='shutdown')shutdown();};process.on('message',onMessage);
 const ticker=setInterval(()=>{if(!queue.heartbeatWorker(lease))stop.abort();},3000);ticker.unref();
 console.log(JSON.stringify({event:'worker.ready',profile:authMode(),execution:'single-node-sqlite'}));process.send?.({type:'worker.ready'});
 try{
  do{
   const result=await runWorkerOnce(queue,lease,stop.signal);
   if(result.worked)console.log(JSON.stringify({event:'worker.run-finished',...result}));
   if(process.argv.includes('--once'))break;
   try{await delay(500,undefined,{signal:stop.signal});}catch(error){if(!stop.signal.aborted)throw error;}
  }while(!stop.signal.aborted);
 }finally{clearInterval(ticker);queue.releaseWorker(lease);queue.store.close();process.off('SIGINT',shutdown);process.off('SIGTERM',shutdown);process.off('message',onMessage);if(process.connected)process.disconnect();}
}
void main().catch(error=>{safeLogger.error('Agent worker stopped',error);process.exitCode=1;});
