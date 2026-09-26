import {createHmac} from 'node:crypto';
import {effectiveProvider,masterKey,providerIDs,type ProviderScope} from '../settings/store';
import {applicationModels,ProviderConfigError,validModelID} from '../ai/provider-catalog';
import {canonicalRunData} from './queue';
/** A keyed opaque digest binds model consent to destination, credential version, routing and deployment scope. */
export function modelBindingDigest(model:string,scope?:ProviderScope):string {
 if(!validModelID(model))throw new ProviderConfigError('Invalid model identifier',400);
 const prefix=model.slice(0,model.indexOf('/'));
 const discovered=providerIDs.find(id=>id!=='gateway'&&id===prefix);
 const provider=model.startsWith('gateway/')?'gateway':applicationModels(scope).find(item=>item.id===model)?.provider??discovered;
 if(!provider)throw new ProviderConfigError('Unknown configured model',400);
 const settings=effectiveProvider(provider,scope),key=masterKey();
 try{return createHmac('sha256',key).update('open-lovable-model-binding-v1\0').update(canonicalRunData({model,provider,settings,scope:scope||null,vercelGatewayKey:scope?null:process.env.AI_GATEWAY_API_KEY||null})).digest('hex');}
 finally{key.fill(0);}
}
