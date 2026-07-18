export const CATALOG_ITEM_TYPES = [
  'skill',
  'workflow',
  'prompt',
  'mcp-server',
  'app',
  'context',
  'model',
  'rule',
] as const

export type CatalogItemType = (typeof CATALOG_ITEM_TYPES)[number]
export type CatalogItemKind = 'skill' | 'prompt' | 'mcp' | 'app' | 'workflow' | 'command' | 'rule'
export type CommandPlatform = 'Claude Code' | 'Codex' | 'Gemeinsam'
export type CatalogSource = 'demo' | 'public-catalog' | 'browser-import' | 'local-api'
export type BrowserDataMode = 'quickgraph' | 'demo' | 'own' | 'virgin'
export type ContextTarget = 'claude' | 'memory' | 'codex'
export type AdapterKind = 'browser' | 'local-api'
export type UsageAction = 'open' | 'copy' | 'invoke'
export type ContextStatus = 'green' | 'yellow' | 'red'
export type ProvenanceClassification = 'first_party' | 'third_party' | 'derived' | 'conflict' | 'unknown'
export type ProvenanceConfidence = 'high' | 'medium' | 'low'
export type IllustrationKind = 'official-logo' | 'official-icon' | 'site-preview' | 'neutral'

export interface CatalogProvenance {
  classification: ProvenanceClassification
  providerLabel?: string
  homepage?: string
  repository?: string
  license?: string
  confidence: ProvenanceConfidence
}

export interface CatalogIllustration {
  src: string
  alt: string
  kind: IllustrationKind
}

export interface CatalogItem {
  id: string
  key: string
  type: CatalogItemType
  kind: CatalogItemKind
  name: string
  description: string
  category: string
  group: string
  commandCategory?: string
  commandPlatform?: CommandPlatform
  origin: string
  source: CatalogSource
  tags: string[]
  content: string
  sourceId?: string
  relativePath?: string
  provenance?: CatalogProvenance
  illustration?: CatalogIllustration
  revision?: string
  owned?: boolean
  invoke?: string
  createdAt?: string
  updatedAt: string
}

export interface CatalogContentUpdateRequest {
  itemId: string
  content: string
  expectedRevision: string
}

export interface CatalogContentUpdateResult {
  item: CatalogItem
  backupCreated: boolean
}

export interface ContextRevision {
  id: string
  target: ContextTarget
  content: string
  sourceName: string
  createdAt: string
  checksum: string
}

export interface UsageDaily {
  date: string
  itemId: string
  count: number
  lastUsedAt: string
}

export interface BackupRecord {
  id: string
  target: ContextTarget
  content: string
  reason: string
  createdAt: string
}

export interface ExternalCacheRecord {
  key: string
  value: unknown
  source: string
  updatedAt: string
  expiresAt?: string
}

export interface MetaRecord {
  key: string
  value: unknown
  updatedAt: string
}

export interface QuickGraphBootstrap {
  items: CatalogItem[]
  apps: AppCatalogMetadata[]
  generatedAt: string
  sourceLabel?: string
}

export interface CatalogTransferItem {
  transferId: string
  key: string
  type: CatalogItemType
  kind: CatalogItemKind
  name: string
  description: string
  category: string
  group: string
  commandCategory?: string
  commandPlatform?: CommandPlatform
  origin: string
  tags: string[]
  content: string
  sourceId?: string
  relativePath?: string
  provenance?: CatalogProvenance
  illustration?: CatalogIllustration
  invoke?: string
  updatedAt: string
}

export interface CatalogTransfer {
  schemaVersion: 1
  exportedAt: string
  items: CatalogTransferItem[]
  usageDaily: CatalogTransferUsageDaily[]
}

export interface CatalogTransferUsageDaily {
  date: string
  transferId: string
  count: number
}

export interface AppCatalogMetadata {
  id: string
  name: string
  type: string
  category: string
  description: string
  available: boolean
  launchConfigured?: boolean
  url: string
  pathHint: string
  stack: string
  status: string
  createdAt: string
  updatedAt: string
  screenshot: string
  screenshotLabel: string
}

export interface UsageEvent {
  itemId: string
  occurredAt: string
  action: UsageAction
}

export interface UsageSummaryDaily {
  date: string
  itemId: string
  count: number
}

export interface UsageSummary {
  adapter: AdapterKind
  daily: UsageSummaryDaily[]
  schemaVersion: 1
  summary: {
    distinctItems: number
    totalEvents: number
  }
  write: {
    accepted: boolean
    persistence: 'indexeddb' | 'local-scanner'
    reason?: string
  }
}

export interface ContextFileOverview {
  target: ContextTarget
  name: 'CLAUDE.md' | 'MEMORY.md' | 'AGENTS.md'
  content: string
  source: 'import' | 'filesystem'
  path?: string
  lines: number
  chars?: number
  tokens: number
  status: ContextStatus
}

export interface ContextOverview {
  adapter: AdapterKind
  files: ContextFileOverview[]
  schemaVersion: 1
  summary: {
    available: number
    status: ContextStatus
    totalTokens: number
  }
}

export interface AdapterHealth {
  status: 'ok' | 'degraded' | 'unavailable'
  adapter: AdapterKind
  detail?: string
}

export interface ContextPrepareRequest {
  feedback?: string
}

export interface ContextConfirmRequest {
  prepareId: string
  draft: string
  feedback?: string
}

export interface ContextPrepareResult {
  prepareId: string
  target: ContextTarget
  before: string
  preview: string
  backupId: string
  expiresAt: string
}

export interface ContextConfirmResult {
  target: ContextTarget
  before: string
  after: string
  backupId: string
}

export interface AppHealth {
  id: string
  status: 'ready' | 'starting' | 'stopped' | 'unavailable'
  url?: string
}

export interface AppLaunchResult extends AppHealth {
  status: 'ready' | 'starting'
}

export interface RefreshModelsResult {
  updated: number
  refreshedAt: string
}

export interface ScanSourcesResult {
  indexed: number
  scannedAt: string
  sources: Array<{
    id: string
    status: 'ok' | 'error'
    itemCount: number
    fingerprint?: string | null
    reason?: string | null
  }>
}

export interface OperationReceipt {
  operationId: string
  status: 'accepted' | 'completed'
}

export type ModelRefreshResult = RefreshModelsResult
