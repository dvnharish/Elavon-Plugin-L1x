/**
 * Performance Monitor and Caching System
 * Provides performance tracking and intelligent caching for all operations
 */

import * as vscode from 'vscode'
import { Logger } from './logger'
import { ValidationCache, FileStandardCache } from '../types/contextMenu'

export interface PerformanceMetrics {
  operation: string
  duration: number
  filePath: string | undefined
  fileSize: number | undefined
  cacheHit: boolean
  timestamp: Date
}

export interface CacheStats {
  totalEntries: number
  hitRate: number
  memoryUsage: number
  oldestEntry: Date
  newestEntry: Date
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private validationCache = new Map<string, ValidationCache>()
  private standardCache = new Map<string, FileStandardCache>()
  private readonly maxCacheSize = 1000
  private readonly cacheExpiryMs = 30 * 60 * 1000 // 30 minutes

  constructor(private context: vscode.ExtensionContext) {
    this.loadCacheFromStorage()
    this.setupCacheCleanup()
  }

  /**
   * Track performance metrics for an operation
   */
  async trackOperation<T>(
    operation: string,
    filePath: string | undefined,
    task: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now()
    let fileSize: number | undefined
    let cacheHit = false

    try {
      // Check if we have cached result
      const cacheKey = this.getCacheKey(operation, filePath)
      const cached = this.getCachedResult(operation, cacheKey)
      
      if (cached) {
        cacheHit = true
        Logger.info(`Cache hit for ${operation}`, { filePath, cacheKey })
        return cached as T
      }

      // Get file size if available
      if (filePath) {
        try {
          const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath))
          fileSize = stat.size
        } catch (error) {
          // File size not critical, continue without it
        }
      }

      // Execute the operation
      const result = await task()

      // Cache the result if appropriate
      if (this.shouldCache(operation)) {
        this.setCachedResult(operation, cacheKey, result)
      }

      return result
    } finally {
      // Record metrics
      const duration = Date.now() - startTime
      this.recordMetrics({
        operation,
        duration,
        filePath,
        fileSize,
        cacheHit,
        timestamp: new Date()
      })
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    totalOperations: number
    averageDuration: number
    cacheHitRate: number
    slowestOperations: PerformanceMetrics[]
    recentOperations: PerformanceMetrics[]
  } {
    const totalOps = this.metrics.length
    const avgDuration = totalOps > 0 
      ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalOps 
      : 0
    
    const cacheHits = this.metrics.filter(m => m.cacheHit).length
    const cacheHitRate = totalOps > 0 ? (cacheHits / totalOps) * 100 : 0

    const slowestOps = [...this.metrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)

    const recentOps = [...this.metrics]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 20)

    return {
      totalOperations: totalOps,
      averageDuration: Math.round(avgDuration),
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      slowestOperations: slowestOps,
      recentOperations: recentOps
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    const allCaches = [
      ...Array.from(this.validationCache.values()),
      ...Array.from(this.standardCache.values())
    ]

    const totalEntries = allCaches.length
    const hitRate = this.getPerformanceStats().cacheHitRate
    const memoryUsage = this.estimateMemoryUsage()
    
    const timestamps = allCaches.map(c => c.cachedAt)
    const oldestEntry = timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : new Date()
    const newestEntry = timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : new Date()

    return {
      totalEntries,
      hitRate,
      memoryUsage,
      oldestEntry,
      newestEntry
    }
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.validationCache.clear()
    this.standardCache.clear()
    this.saveCacheToStorage()
    Logger.info('All caches cleared')
  }

  /**
   * Warm up caches for frequently accessed files
   */
  async warmupCaches(filePaths: string[]): Promise<void> {
    Logger.info(`Warming up caches for ${filePaths.length} files`)
    
    // This would typically pre-load standard detection and validation results
    // for frequently accessed files in the background
    for (const filePath of filePaths.slice(0, 10)) { // Limit to prevent overload
      try {
        // Pre-compute file hash for cache key
        const fileHash = await this.computeFileHash(filePath)
        Logger.info(`Cache warmup for ${filePath}`, { fileHash })
      } catch (error) {
        Logger.warn(`Cache warmup failed for ${filePath}`, error as Error)
      }
    }
  }

  private recordMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics)
    
    // Keep only recent metrics to prevent memory bloat
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-500)
    }

    // Log slow operations
    if (metrics.duration > 5000) { // 5 seconds
      Logger.warn(`Slow operation detected: ${metrics.operation}`, {
        duration: metrics.duration,
        filePath: metrics.filePath,
        fileSize: metrics.fileSize
      })
    }
  }

  private getCacheKey(operation: string, filePath?: string): string {
    return `${operation}:${filePath || 'global'}`
  }

  private getCachedResult(operation: string, cacheKey: string): any {
    const now = Date.now()
    
    if (operation.includes('validation')) {
      const cached = this.validationCache.get(cacheKey)
      if (cached && now - cached.cachedAt.getTime() < this.cacheExpiryMs) {
        return cached.result
      }
    }
    
    if (operation.includes('standard')) {
      const cached = this.standardCache.get(cacheKey)
      if (cached && now - cached.cachedAt.getTime() < this.cacheExpiryMs) {
        return cached.result
      }
    }
    
    return null
  }

  private setCachedResult(operation: string, cacheKey: string, result: any): void {
    const now = new Date()
    
    if (operation.includes('validation') && result.filePath) {
      this.validationCache.set(cacheKey, {
        filePath: result.filePath,
        fileHash: '', // Would compute actual hash in production
        result,
        cachedAt: now,
        expiresAt: new Date(now.getTime() + this.cacheExpiryMs)
      })
    }
    
    if (operation.includes('standard') && result.filePath) {
      this.standardCache.set(cacheKey, {
        filePath: result.filePath,
        fileHash: '', // Would compute actual hash in production
        result,
        cachedAt: now,
        expiresAt: new Date(now.getTime() + this.cacheExpiryMs)
      })
    }

    // Enforce cache size limits
    this.enforceCacheLimits()
    this.saveCacheToStorage()
  }

  private shouldCache(operation: string): boolean {
    // Cache expensive operations
    return operation.includes('validation') || 
           operation.includes('standard') || 
           operation.includes('comparison')
  }

  private enforceCacheLimits(): void {
    if (this.validationCache.size > this.maxCacheSize) {
      const entries = Array.from(this.validationCache.entries())
      entries.sort((a, b) => a[1].cachedAt.getTime() - b[1].cachedAt.getTime())
      
      // Remove oldest 20% of entries
      const toRemove = Math.floor(entries.length * 0.2)
      for (let i = 0; i < toRemove; i++) {
        this.validationCache.delete(entries[i]?.[0] || '')
      }
    }

    if (this.standardCache.size > this.maxCacheSize) {
      const entries = Array.from(this.standardCache.entries())
      entries.sort((a, b) => a[1].cachedAt.getTime() - b[1].cachedAt.getTime())
      
      const toRemove = Math.floor(entries.length * 0.2)
      for (let i = 0; i < toRemove; i++) {
        this.standardCache.delete(entries[i]?.[0] || '')
      }
    }
  }

  private setupCacheCleanup(): void {
    // Clean up expired cache entries every 10 minutes
    setInterval(() => {
      this.cleanupExpiredEntries()
    }, 10 * 60 * 1000)
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now()
    let removedCount = 0

    // Clean validation cache
    for (const [key, entry] of this.validationCache.entries()) {
      if (now > entry.expiresAt.getTime()) {
        this.validationCache.delete(key)
        removedCount++
      }
    }

    // Clean standard cache
    for (const [key, entry] of this.standardCache.entries()) {
      if (now > entry.expiresAt.getTime()) {
        this.standardCache.delete(key)
        removedCount++
      }
    }

    if (removedCount > 0) {
      Logger.info(`Cleaned up ${removedCount} expired cache entries`)
      this.saveCacheToStorage()
    }
  }

  private async computeFileHash(filePath: string): Promise<string> {
    try {
      const content = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
      // Simple hash - in production would use crypto
      return content.length.toString() + content.slice(0, 100).toString()
    } catch (error) {
      return 'unknown'
    }
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of cache memory usage in bytes
    const validationSize = this.validationCache.size * 1024 // ~1KB per entry
    const standardSize = this.standardCache.size * 512 // ~512B per entry
    return validationSize + standardSize
  }

  private loadCacheFromStorage(): void {
    try {
      const validationData = this.context.globalState.get('validationCache', {})
      const standardData = this.context.globalState.get('standardCache', {})
      
      // Restore caches (simplified - would need proper serialization)
      Logger.info('Cache loaded from storage', {
        validationEntries: Object.keys(validationData).length,
        standardEntries: Object.keys(standardData).length
      })
    } catch (error) {
      Logger.warn('Failed to load cache from storage', error as Error)
    }
  }

  private saveCacheToStorage(): void {
    try {
      // Save caches to VS Code global state (simplified)
      this.context.globalState.update('cacheLastSaved', new Date().toISOString())
    } catch (error) {
      Logger.warn('Failed to save cache to storage', error as Error)
    }
  }

  /**
   * Show performance dashboard
   */
  async showPerformanceDashboard(): Promise<void> {
    const stats = this.getPerformanceStats()
    const cacheStats = this.getCacheStats()

    const panel = vscode.window.createWebviewPanel(
      'performanceDashboard',
      'L1X Performance Dashboard',
      vscode.ViewColumn.One,
      { enableScripts: true }
    )

    panel.webview.html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: var(--vscode-font-family); padding: 2rem; }
            .metric-card { 
                background: var(--vscode-panel-background); 
                padding: 1rem; 
                margin: 1rem 0; 
                border-radius: 4px; 
                border-left: 4px solid var(--vscode-textLink-foreground);
            }
            .metric-value { font-size: 2rem; font-weight: bold; color: var(--vscode-textLink-foreground); }
            .metric-label { color: var(--vscode-descriptionForeground); }
            .operations-list { max-height: 300px; overflow-y: auto; }
            .operation-item { 
                padding: 0.5rem; 
                border-bottom: 1px solid var(--vscode-panel-border);
                display: flex;
                justify-content: space-between;
            }
        </style>
    </head>
    <body>
        <h1>📊 L1X Performance Dashboard</h1>
        
        <div class="metric-card">
            <div class="metric-value">${stats.totalOperations}</div>
            <div class="metric-label">Total Operations</div>
        </div>

        <div class="metric-card">
            <div class="metric-value">${stats.averageDuration}ms</div>
            <div class="metric-label">Average Duration</div>
        </div>

        <div class="metric-card">
            <div class="metric-value">${stats.cacheHitRate}%</div>
            <div class="metric-label">Cache Hit Rate</div>
        </div>

        <div class="metric-card">
            <div class="metric-value">${cacheStats.totalEntries}</div>
            <div class="metric-label">Cache Entries</div>
        </div>

        <h2>Recent Operations</h2>
        <div class="operations-list">
            ${stats.recentOperations.map(op => `
                <div class="operation-item">
                    <span>${op.operation}</span>
                    <span>${op.duration}ms ${op.cacheHit ? '(cached)' : ''}</span>
                </div>
            `).join('')}
        </div>

        <h2>Slowest Operations</h2>
        <div class="operations-list">
            ${stats.slowestOperations.map(op => `
                <div class="operation-item">
                    <span>${op.operation}</span>
                    <span>${op.duration}ms</span>
                </div>
            `).join('')}
        </div>
    </body>
    </html>`
  }
}