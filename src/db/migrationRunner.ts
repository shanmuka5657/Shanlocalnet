import crypto from 'crypto';
import { loadMigrationFiles, MigrationFilePair } from './postgresPool.ts';

export interface MigrationStatus {
  name: string;
  applied: boolean;
  appliedAt?: string;
  checksum: string;
  currentChecksum: string;
}

export interface MigrationResult {
  appliedCount: number;
  migrations: { name: string; status: 'applied' | 'skipped' | 'failed'; error?: string }[];
}

export class MigrationRunner {
  private client: any;

  constructor(client: any) {
    this.client = client;
  }

  public async initMigrationTable(): Promise<void> {
    await this.client.exec(`
      CREATE TABLE IF NOT EXISTS _localnet_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  public computeChecksum(content: string): string {
    const normalized = content.replace(/\r\n/g, '\n').trim();
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  public async getStatus(): Promise<MigrationStatus[]> {
    await this.initMigrationTable();
    const files = loadMigrationFiles();
    const res = await this.client.query('SELECT name, checksum, applied_at FROM _localnet_migrations;');
    const appliedMap = new Map<string, { checksum: string; applied_at: string }>();
    for (const row of res.rows) {
      appliedMap.set(row.name, { checksum: row.checksum, applied_at: row.applied_at });
    }

    return files.map((file) => {
      const currentChecksum = this.computeChecksum(file.upSql);
      const applied = appliedMap.get(file.name);
      return {
        name: file.name,
        applied: Boolean(applied),
        appliedAt: applied ? applied.applied_at : undefined,
        checksum: applied ? applied.checksum : currentChecksum,
        currentChecksum,
      };
    });
  }

  public async executeSqlSafe(sql: string): Promise<void> {
    // If running in an environment where pgcrypto is not an external file but gen_random_uuid is built-in
    try {
      await this.client.exec(sql);
    } catch (err: any) {
      if (err?.message?.includes('extension "pgcrypto" is not available')) {
        // Safe fallback: strip pgcrypto creation since gen_random_uuid is native in PostgreSQL 13+
        const sanitized = sql.replace(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"pgcrypto";?/gi, '-- pgcrypto native fallback');
        await this.client.exec(sanitized);
      } else {
        throw err;
      }
    }
  }

  public async runMigrations(): Promise<MigrationResult> {
    await this.initMigrationTable();
    const files = loadMigrationFiles();
    const result: MigrationResult = {
      appliedCount: 0,
      migrations: [],
    };

    for (const file of files) {
      const currentChecksum = this.computeChecksum(file.upSql);
      const checkRes = await this.client.query(
        'SELECT checksum FROM _localnet_migrations WHERE name = $1;',
        [file.name]
      );

      if (checkRes.rows && checkRes.rows.length > 0) {
        const storedChecksum = checkRes.rows[0].checksum;
        const crlfChecksum = crypto.createHash('sha256').update(file.upSql.replace(/\r?\n/g, '\r\n').trim()).digest('hex');
        const lfChecksum = crypto.createHash('sha256').update(file.upSql.replace(/\r\n/g, '\n').trim()).digest('hex');

        // Cross-platform compatibility check (Windows CRLF vs Linux LF)
        if (storedChecksum === currentChecksum || storedChecksum === crlfChecksum || storedChecksum === lfChecksum) {
          if (storedChecksum !== currentChecksum) {
            await this.client.query('UPDATE _localnet_migrations SET checksum = $1 WHERE name = $2;', [currentChecksum, file.name]);
          }
          result.migrations.push({ name: file.name, status: 'skipped' });
          continue;
        }

        throw new Error(
          `Migration checksum mismatch for "${file.name}". Stored: ${storedChecksum}, Current: ${currentChecksum}. Aborting to protect database integrity.`
        );
      }

      // Execute migration
      try {
        await this.executeSqlSafe(file.upSql);
        await this.client.query(
          'INSERT INTO _localnet_migrations (name, checksum, applied_at) VALUES ($1, $2, NOW());',
          [file.name, currentChecksum]
        );
        result.appliedCount++;
        result.migrations.push({ name: file.name, status: 'applied' });
      } catch (err: any) {
        result.migrations.push({ name: file.name, status: 'failed', error: err?.message || String(err) });
        throw new Error(`Migration "${file.name}" failed: ${err?.message || String(err)}`);
      }
    }

    return result;
  }

  public async rollbackMigration(targetName: string): Promise<boolean> {
    await this.initMigrationTable();
    const files = loadMigrationFiles();
    const target = files.find((f) => f.name === targetName);
    if (!target) {
      throw new Error(`Migration "${targetName}" not found in migration files.`);
    }

    if (!target.downSql || target.downSql.trim().length === 0) {
      throw new Error(`Migration "${targetName}" does not define downSql for rollback.`);
    }

    await this.client.exec(target.downSql);
    await this.client.query('DELETE FROM _localnet_migrations WHERE name = $1;', [targetName]);
    return true;
  }
}
