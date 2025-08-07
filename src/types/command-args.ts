/**
 * Command arguments structure
 */
export interface CommandArgs extends Record<string, unknown> {
  /**
   * Raw unparsed argument string
   */
  _raw?: string

  /**
   * Positional arguments array
   */
  _positional?: string[]
}
