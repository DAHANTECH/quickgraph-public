/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_QUICKGRAPH_ADAPTER?: 'browser' | 'local-api'
  readonly VITE_QUICKGRAPH_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
