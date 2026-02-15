type RequestLogEntry = {
  id: string
  at: string
  path: string
  query: string
  duration_ms: number
  status: number
  live_source: 'open-meteo' | 'mock'
  live_path: string
  fallback?: string
  cache_hit: boolean
}

const MAX_LOG_ENTRIES = 80
const logStore: RequestLogEntry[] = []

export function addRequestLog(entry: RequestLogEntry) {
  logStore.unshift(entry)
  if (logStore.length > MAX_LOG_ENTRIES) {
    logStore.length = MAX_LOG_ENTRIES
  }
}

export function getRecentRequestLogs(limit = 10) {
  return logStore.slice(0, Math.max(1, Math.min(50, limit)))
}

