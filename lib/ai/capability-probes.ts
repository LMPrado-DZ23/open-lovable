import type {ModelOption} from './provider-catalog';

export type CapabilityName='text'|'coding'|'vision'|'tools'|'reasoning';
export type CapabilityState='supported'|'unsupported'|'unknown';
export interface CapabilityEvidence {
  modelId:string;
  capability:CapabilityName;
  state:CapabilityState;
  source:'declared'|'probe'|'unknown';
  alternatives:string[];
  requiresExplicitSelection:boolean;
  reason:string;
}

/**
 * Resolves capability information without changing the selected model. A missing
 * capability is never treated as permission to silently fall back elsewhere.
 */
export function assessCapability(model:ModelOption,capability:CapabilityName,catalog:ModelOption[]):CapabilityEvidence {
  const declared=model.capabilities.includes(capability);
  const state:CapabilityState=model.capabilityStatus==='unknown'?'unknown':declared?'supported':'unsupported';
  const alternatives=catalog.filter(option=>option.id!==model.id&&option.configured&&option.capabilities.includes(capability)).map(option=>option.id).sort();
  const reason=state==='supported'?'Capability is declared by the configured model.':state==='unknown'?'Capability has not been tested for this model; explicit confirmation or a real probe is required.':'Capability is not declared by this model; choose an alternative explicitly.';
  return {modelId:model.id,capability,state,source:model.capabilityStatus==='unknown'?'unknown':'declared',alternatives,requiresExplicitSelection:state!=='supported',reason};
}

export function assertCapability(model:ModelOption,capability:CapabilityName,catalog:ModelOption[]):CapabilityEvidence {
  const evidence=assessCapability(model,capability,catalog);
  if(evidence.state!=='supported') {
    const suffix=evidence.alternatives.length?` Available alternatives: ${evidence.alternatives.join(', ')}.`:' No configured alternative is available.';
    throw new Error(`${evidence.reason}${suffix} Select a model explicitly; no silent fallback was applied.`);
  }
  return evidence;
}
