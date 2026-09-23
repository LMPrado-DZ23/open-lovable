import { createGroq } from '@ai-sdk/groq';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { applicationModels, getGatewayConfig, loadModelCatalog, ProviderConfigError, validModelID, type ModelOption } from './provider-catalog';
import { createProviderFetch } from './provider-transport';

/** One server-side resolver for generation, search planning and recovery. Never guesses a provider. */
export async function getProviderForModel(modelId: string, signal?: AbortSignal) {
  if (!validModelID(modelId)) throw new ProviderConfigError('Invalid model identifier',400);
  let option: ModelOption | undefined;
  if (modelId.startsWith('gateway/')) {
    option=(await loadModelCatalog(signal)).models.find(model => model.id===modelId);
  } else option=applicationModels().find(model => model.id===modelId);
  if (!option) throw new ProviderConfigError('Model is not in the configured provider catalog',400);
  if (!option.configured) throw new ProviderConfigError('Model provider credentials are not configured');
  const actualModel=option.upstreamId;
  if (option.provider==='gateway') {
    const config=getGatewayConfig();
    if (!config) throw new ProviderConfigError('Gateway provider is not configured');
    const client=createOpenAI({baseURL:config.baseURL,apiKey:config.apiKey ?? 'ollama',
      fetch:createProviderFetch(config.baseURL,{allowLoopback:true})});
    return {model:client.chat(actualModel),actualModel,option};
  }
  // Vercel gateway has an OpenAI-compatible chat protocol and requires the full provider/model namespace.
  const gatewayKey=process.env.AI_GATEWAY_API_KEY?.trim();
  if (gatewayKey) {
    const baseURL='https://ai-gateway.vercel.sh/v1';
    const client=createOpenAI({apiKey:gatewayKey,baseURL,fetch:createProviderFetch(baseURL)});
    const upstream=option.provider==='groq' ? option.upstreamId : option.id;
    return {model:client.chat(upstream),actualModel:upstream,option};
  }
  switch(option.provider) {
    case 'openai': {
      const baseURL=process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
      return {model:createOpenAI({apiKey:process.env.OPENAI_API_KEY,baseURL,fetch:createProviderFetch(baseURL,{allowLoopback:Boolean(process.env.OPENAI_BASE_URL)})})(actualModel),actualModel,option};
    }
    case 'anthropic': {
      const baseURL=process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1';
      return {model:createAnthropic({apiKey:process.env.ANTHROPIC_API_KEY,baseURL,fetch:createProviderFetch(baseURL,{allowLoopback:Boolean(process.env.ANTHROPIC_BASE_URL)})})(actualModel),actualModel,option};
    }
    case 'google': {
      const baseURL=process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
      return {model:createGoogleGenerativeAI({apiKey:process.env.GEMINI_API_KEY,baseURL,fetch:createProviderFetch(baseURL,{allowLoopback:Boolean(process.env.GEMINI_BASE_URL)})})(actualModel),actualModel,option};
    }
    case 'groq': {
      const baseURL=process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
      return {model:createGroq({apiKey:process.env.GROQ_API_KEY,baseURL,fetch:createProviderFetch(baseURL,{allowLoopback:Boolean(process.env.GROQ_BASE_URL)})})(actualModel),actualModel,option};
    }
  }
}
export default getProviderForModel;
