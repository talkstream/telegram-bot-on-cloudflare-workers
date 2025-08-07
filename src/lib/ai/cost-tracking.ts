import { logger } from '../logger'

import type { CostCalculator, CostEstimate, CostFactors, UsageMetrics } from './types'

/**
 * Abstract cost calculator that can be extended with different cost sources
 */
export abstract class BaseCostCalculator implements CostCalculator {
  protected costCache = new Map<string, { factors: CostFactors; expires: number }>()
  protected cacheTimeout = 3600000 // 1 hour

  abstract fetchCostFactors(providerId: string): Promise<CostFactors | null>

  async calculateCost(usage: UsageMetrics, providerId: string): Promise<CostEstimate | null> {
    const factors = await this.getCostFactors(providerId)
    if (!factors) {
      return null
    }

    let totalCost = 0
    const breakdown: CostEstimate['breakdown'] = {}

    // Calculate input cost
    if (factors.inputUnitCost && usage.inputUnits) {
      breakdown.input = usage.inputUnits * factors.inputUnitCost
      totalCost += breakdown.input
    }

    // Calculate output cost
    if (factors.outputUnitCost && usage.outputUnits) {
      breakdown.output = usage.outputUnits * factors.outputUnitCost
      totalCost += breakdown.output
    }

    // Calculate compute cost
    if (factors.computeUnitCost && usage.computeUnits) {
      breakdown.compute = usage.computeUnits * factors.computeUnitCost
      totalCost += breakdown.compute
    }

    // Calculate custom metrics cost
    if (factors.customCosts && usage.customMetrics) {
      breakdown.other = {}
      for (const [metric, value] of Object.entries(usage.customMetrics)) {
        if (factors.customCosts[metric]) {
          breakdown.other[metric] = value * factors.customCosts[metric]
          totalCost += breakdown.other[metric]
        }
      }
    }

    const confidence = this.determineConfidence(factors)
    return {
      amount: totalCost,
      currency: factors.currency,
      breakdown,
      ...(confidence && { confidence })
    }
  }

  async getCostFactors(providerId: string): Promise<CostFactors | null> {
    // Check cache first
    const cached = this.costCache.get(providerId)
    if (cached && cached.expires > Date.now()) {
      return cached.factors
    }

    // Fetch fresh data
    try {
      const factors = await this.fetchCostFactors(providerId)
      if (factors) {
        // Cache the result
        this.costCache.set(providerId, {
          factors,
          expires: Date.now() + this.cacheTimeout
        })
      }
      return factors
    } catch (error) {
      logger.error(`Failed to fetch cost factors for ${providerId}:`, error)
      return null
    }
  }

  async updateCostFactors(providerId: string, factors: CostFactors): Promise<void> {
    // Update cache immediately
    this.costCache.set(providerId, {
      factors,
      expires: Date.now() + this.cacheTimeout
    })
  }

  protected determineConfidence(factors: CostFactors): CostEstimate['confidence'] {
    const age = Date.now() - factors.lastUpdated.getTime()
    const dayInMs = 24 * 60 * 60 * 1000

    if (age < dayInMs) return 'high'
    if (age < 7 * dayInMs) return 'medium'
    return 'low'
  }
}

/**
 * Config-based cost calculator that reads from environment or config files
 */
export class ConfigBasedCostCalculator extends BaseCostCalculator {
  constructor(private config: Record<string, CostFactors> = {}) {
    super()
  }

  async fetchCostFactors(providerId: string): Promise<CostFactors | null> {
    return this.config[providerId] || null
  }

  setProviderConfig(providerId: string, factors: CostFactors): void {
    this.config[providerId] = factors
  }
}

/**
 * Remote cost calculator that fetches prices from an API
 */
export class RemoteCostCalculator extends BaseCostCalculator {
  constructor(
    private apiUrl: string,
    private apiKey?: string
  ) {
    super()
  }

  async fetchCostFactors(providerId: string): Promise<CostFactors | null> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`
      }

      const response = await fetch(`${this.apiUrl}/providers/${providerId}/costs`, {
        headers
      })

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error(`API returned ${response.status}`)
      }

      const data = (await response.json()) as {
        inputUnitCost?: number
        outputUnitCost?: number
        computeUnitCost?: number
        customCosts?: Record<string, number>
        currency?: string
        lastUpdated?: string | number
      }

      return {
        inputUnitCost: data.inputUnitCost || 0,
        outputUnitCost: data.outputUnitCost || 0,
        computeUnitCost: data.computeUnitCost || 0,
        customCosts: data.customCosts || {},
        currency: data.currency || 'USD',
        lastUpdated: new Date(data.lastUpdated || Date.now()),
        source: this.apiUrl
      }
    } catch (error) {
      logger.error(`Failed to fetch cost factors from API:`, error)
      return null
    }
  }
}

/**
 * Cost tracker that accumulates usage and costs over time
 */
export class CostTracker {
  private usage = new Map<string, UsageMetrics>()
  private costs = new Map<string, CostEstimate>()

  constructor(private calculator: CostCalculator) {}

  async trackUsage(providerId: string, usage: UsageMetrics): Promise<CostEstimate | null> {
    // Accumulate usage
    const existing = this.usage.get(providerId) || {
      inputUnits: 0,
      outputUnits: 0,
      computeUnits: 0,
      customMetrics: {}
    }

    const accumulated: UsageMetrics = {
      inputUnits: existing.inputUnits + usage.inputUnits,
      outputUnits: existing.outputUnits + usage.outputUnits,
      computeUnits: (existing.computeUnits || 0) + (usage.computeUnits || 0)
    }

    // Merge custom metrics
    if (usage.customMetrics || existing.customMetrics) {
      accumulated.customMetrics = { ...existing.customMetrics }
      if (usage.customMetrics) {
        for (const [key, value] of Object.entries(usage.customMetrics)) {
          accumulated.customMetrics[key] = (accumulated.customMetrics[key] || 0) + value
        }
      }
    }

    this.usage.set(providerId, accumulated)

    // Calculate cost
    const cost = await this.calculator.calculateCost(usage, providerId)

    if (cost) {
      // Accumulate costs
      const existingCost = this.costs.get(providerId)
      if (existingCost) {
        cost.amount += existingCost.amount
        // Merge breakdown
        if (cost.breakdown && existingCost.breakdown) {
          for (const [key, value] of Object.entries(existingCost.breakdown)) {
            if (key === 'other' && cost.breakdown.other && existingCost.breakdown.other) {
              // Merge other costs
              for (const [otherKey, otherValue] of Object.entries(existingCost.breakdown.other)) {
                cost.breakdown.other[otherKey] = (cost.breakdown.other[otherKey] || 0) + otherValue
              }
            } else {
              const breakdownKey = key as keyof Omit<typeof cost.breakdown, 'other'>
              if (breakdownKey in cost.breakdown) {
                ;(cost.breakdown[breakdownKey] as number) =
                  ((cost.breakdown[breakdownKey] as number) || 0) + (value as number)
              }
            }
          }
        }
      }
      this.costs.set(providerId, cost)
    }

    return cost
  }

  getUsage(providerId?: string): UsageMetrics | Map<string, UsageMetrics> {
    if (providerId) {
      return (
        this.usage.get(providerId) || {
          inputUnits: 0,
          outputUnits: 0
        }
      )
    }
    return new Map(this.usage)
  }

  getCosts(providerId?: string): CostEstimate | Map<string, CostEstimate> | null {
    if (providerId) {
      return this.costs.get(providerId) || null
    }
    return new Map(this.costs)
  }

  reset(providerId?: string): void {
    if (providerId) {
      this.usage.delete(providerId)
      this.costs.delete(providerId)
    } else {
      this.usage.clear()
      this.costs.clear()
    }
  }

  getTotalCost(currency: string = 'USD'): number {
    let total = 0
    for (const cost of this.costs.values()) {
      if (cost.currency === currency) {
        total += cost.amount
      }
      // Note: Currency conversion would require additional logic
    }
    return total
  }
}
