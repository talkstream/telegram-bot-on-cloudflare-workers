/**
 * Field Mapper Utility
 *
 * Provides type-safe field mapping for object transformations
 * Reduces boilerplate and ensures consistent mapping patterns
 *
 * @module lib/field-mapper
 */

/**
 * Field mapping configuration
 */
export interface FieldMapping<TSource, TTarget> {
  source: keyof TSource | ((src: TSource) => unknown)
  target: keyof TTarget
  transform?: (value: unknown) => unknown
}

/**
 * Create a field mapper function
 */
export class FieldMapper<TSource, TTarget> {
  private mappings: FieldMapping<TSource, TTarget>[] = []

  /**
   * Add a field mapping
   */
  map(
    source: keyof TSource | ((src: TSource) => unknown),
    target: keyof TTarget,
    transform?: (value: unknown) => unknown
  ): this {
    this.mappings.push({ source, target, transform })
    return this
  }

  /**
   * Add a computed field
   */
  compute(target: keyof TTarget, compute: (src: TSource) => unknown): this {
    this.mappings.push({
      source: compute,
      target
    })
    return this
  }

  /**
   * Build the mapper function
   */
  build(): (source: TSource) => TTarget {
    const mappings = this.mappings

    return (source: TSource): TTarget => {
      const result = {} as TTarget

      for (const mapping of mappings) {
        let value: unknown

        if (typeof mapping.source === 'function') {
          value = mapping.source(source)
        } else {
          value = source[mapping.source]
        }

        if (mapping.transform) {
          value = mapping.transform(value)
        }

        ;(result as Record<keyof TTarget, unknown>)[mapping.target] = value
      }

      return result
    }
  }

  /**
   * Create a static mapper
   */
  static create<TSource, TTarget>(): FieldMapper<TSource, TTarget> {
    return new FieldMapper<TSource, TTarget>()
  }
}

/**
 * Create a simple field mapper
 */
export function createFieldMapper<TSource, TTarget>(
  mappings: Array<{
    from: keyof TSource | ((src: TSource) => unknown)
    to: keyof TTarget
    transform?: (value: unknown) => unknown
  }>
): (source: TSource) => TTarget {
  const mapper = new FieldMapper<TSource, TTarget>()

  for (const { from, to, transform } of mappings) {
    mapper.map(from, to, transform)
  }

  return mapper.build()
}

/**
 * Common field transformers
 */
export const transformers = {
  toBoolean: (value: unknown): boolean => Boolean(value),
  toString: (value: unknown): string => String(value),
  toNumber: (value: unknown): number => Number(value),
  toDate: (value: unknown): Date => new Date(value as string | number),
  toArray: <T>(value: unknown): T[] => (Array.isArray(value) ? value : [value as T]),
  toJSON: (value: unknown): string => JSON.stringify(value),
  fromJSON: <T>(value: unknown): T => JSON.parse(value as string)
}
