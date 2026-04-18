/** Module definition contract — each module implements this */
export interface ModuleDefinition {
  id: string
  version: string
  displayName: string
  description: string
  dependencies: string[]
  events: {
    emits: string[]
    listens: string[]
  }
  featureFlag?: string
  pricing?: {
    tier: 'core' | 'standard' | 'pro' | 'addon'
    monthlyPrice?: number
  }
}
