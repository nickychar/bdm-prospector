import type { ContractType, Seniority } from '../types.js'

type ContractResult = ContractType | 'permanent'

const CONTRACT_MAP: Record<string, ContractResult> = {
  detachering: 'interim', interim: 'interim', flex: 'interim', flexibel: 'interim',
  zzp: 'interim', freelance: 'interim',
  tijdelijk: 'temp', temporary: 'temp', temp: 'temp',
  contract: 'contract',
  vast: 'permanent', fulltime: 'permanent', 'full-time': 'permanent',
  permanent: 'permanent', vaste: 'permanent',
}

const SENIORITY_MAP: Record<string, Seniority> = {
  directeur: 'director', director: 'director', cfo: 'director', coo: 'director', cto: 'director', ceo: 'director',
  hoofd: 'head', 'head of': 'head', head: 'head',
  manager: 'manager', senior: 'manager', lead: 'manager', principal: 'manager',
}

export function normaliseContractType(raw: string): ContractResult {
  return CONTRACT_MAP[raw.trim().toLowerCase()] ?? 'other'
}

export function normaliseSeniority(raw: string): Seniority {
  return SENIORITY_MAP[raw.trim().toLowerCase()] ?? 'other'
}

export function isPermanent(contractType: ContractResult): boolean {
  return contractType === 'permanent'
}
