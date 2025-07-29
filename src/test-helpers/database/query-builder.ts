/**
 * Test query builder for creating realistic SQL queries in tests
 */

export interface TestQuery {
  sql: string;
  params: unknown[];
}

/**
 * Fluent SQL query builder for tests
 */
export class TestQueryBuilder {
  private table = '';
  private selectColumns: string[] = ['*'];
  private whereConditions: Array<{ column: string; operator: string; value: unknown }> = [];
  private orderByColumns: Array<{ column: string; direction: 'ASC' | 'DESC' }> = [];
  private limitValue?: number;
  private offsetValue?: number;
  private joinClauses: Array<{ type: string; table: string; condition: string }> = [];

  select(...columns: string[]): this {
    this.selectColumns = columns.length > 0 ? columns : ['*'];
    return this;
  }

  from(table: string): this {
    this.table = table;
    return this;
  }

  where(column: string, operator: string, value: unknown): this {
    this.whereConditions.push({ column, operator, value });
    return this;
  }

  whereIn(column: string, values: unknown[]): this {
    this.whereConditions.push({ column, operator: 'IN', value: values });
    return this;
  }

  join(table: string, condition: string): this {
    this.joinClauses.push({ type: 'JOIN', table, condition });
    return this;
  }

  leftJoin(table: string, condition: string): this {
    this.joinClauses.push({ type: 'LEFT JOIN', table, condition });
    return this;
  }

  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderByColumns.push({ column, direction });
    return this;
  }

  limit(value: number): this {
    this.limitValue = value;
    return this;
  }

  offset(value: number): this {
    this.offsetValue = value;
    return this;
  }

  build(): TestQuery {
    const params: unknown[] = [];
    let sql = `SELECT ${this.selectColumns.join(', ')} FROM ${this.table}`;

    // Add joins
    for (const join of this.joinClauses) {
      sql += ` ${join.type} ${join.table} ON ${join.condition}`;
    }

    // Add where conditions
    if (this.whereConditions.length > 0) {
      const conditions = this.whereConditions.map(({ column, operator, value }) => {
        if (operator === 'IN' && Array.isArray(value)) {
          const placeholders = value
            .map(() => {
              params.push(value);
              return '?';
            })
            .join(', ');
          return `${column} IN (${placeholders})`;
        } else {
          params.push(value);
          return `${column} ${operator} ?`;
        }
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add order by
    if (this.orderByColumns.length > 0) {
      const orderClauses = this.orderByColumns.map(
        ({ column, direction }) => `${column} ${direction}`,
      );
      sql += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    // Add limit/offset
    if (this.limitValue !== undefined) {
      sql += ` LIMIT ${this.limitValue}`;
    }
    if (this.offsetValue !== undefined) {
      sql += ` OFFSET ${this.offsetValue}`;
    }

    return { sql, params };
  }
}

/**
 * Helper to create INSERT queries
 */
export function createInsertQuery(table: string, data: Record<string, unknown>): TestQuery {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map(() => '?').join(', ');

  return {
    sql: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
    params: values,
  };
}

/**
 * Helper to create UPDATE queries
 */
export function createUpdateQuery(
  table: string,
  data: Record<string, unknown>,
  where: Record<string, unknown>,
): TestQuery {
  const setColumns = Object.keys(data);
  const setValues = Object.values(data);
  const whereColumns = Object.keys(where);
  const whereValues = Object.values(where);

  const setClauses = setColumns.map((col) => `${col} = ?`).join(', ');
  const whereClauses = whereColumns.map((col) => `${col} = ?`).join(' AND ');

  return {
    sql: `UPDATE ${table} SET ${setClauses} WHERE ${whereClauses}`,
    params: [...setValues, ...whereValues],
  };
}

/**
 * Helper to create DELETE queries
 */
export function createDeleteQuery(table: string, where: Record<string, unknown>): TestQuery {
  const whereColumns = Object.keys(where);
  const whereValues = Object.values(where);
  const whereClauses = whereColumns.map((col) => `${col} = ?`).join(' AND ');

  return {
    sql: `DELETE FROM ${table} WHERE ${whereClauses}`,
    params: whereValues,
  };
}
