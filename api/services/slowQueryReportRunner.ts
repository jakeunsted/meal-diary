import { QueryTypes, type Transaction } from 'sequelize';
import sequelize from '../db/models/index.ts';
import {
  findSequentialScanTables,
  findSlowStatements,
  formatActiveQueryMessage,
  formatSequentialScanMessage,
  formatSlowStatementMessage,
  isIgnoredQuery,
  SLOW_QUERY_WEBHOOK_TEST_MESSAGE,
  type ActiveQuery,
  type StatementSnapshot,
  type StatementStat,
  type TableSnapshot,
  type TableStat,
} from './slowQueryReport.ts';

const MAX_STATEMENT_POSTS = 5;
const MAX_ACTIVE_POSTS = 5;
const MAX_TABLE_POSTS = 3;
const REPORT_LOCK_KEY = 814202604;

const asNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const selectRows = async <Row extends Record<string, unknown>>(
  sql: string,
  transaction?: Transaction
): Promise<Row[]> => {
  const rows = await sequelize.query(sql, { type: QueryTypes.SELECT, transaction });
  return rows as Row[];
};

const ensureSnapshotTables = async (): Promise<void> => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS slow_query_statement_snapshots (
      queryid text PRIMARY KEY,
      calls bigint NOT NULL,
      total_exec_time double precision NOT NULL,
      shared_blks_read bigint NOT NULL,
      captured_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS slow_query_table_snapshots (
      relname text PRIMARY KEY,
      seq_scan bigint NOT NULL,
      idx_scan bigint NOT NULL,
      captured_at timestamptz NOT NULL DEFAULT now()
    )
  `);
};

const loadStatementSnapshots = async (transaction: Transaction): Promise<StatementSnapshot[]> => {
  const rows = await selectRows<{
    queryid: string;
    calls: string;
    total_exec_time: string;
    shared_blks_read: string;
  }>('SELECT queryid, calls, total_exec_time, shared_blks_read FROM slow_query_statement_snapshots', transaction);

  return rows.map((row) => ({
    queryid: String(row.queryid),
    calls: asNumber(row.calls),
    totalExecTimeMs: asNumber(row.total_exec_time),
    sharedBlksRead: asNumber(row.shared_blks_read),
  }));
};

const loadTableSnapshots = async (transaction: Transaction): Promise<TableSnapshot[]> => {
  const rows = await selectRows<{ relname: string; seq_scan: string; idx_scan: string }>(
    'SELECT relname, seq_scan, idx_scan FROM slow_query_table_snapshots',
    transaction
  );

  return rows.map((row) => ({
    relname: String(row.relname),
    seqScan: asNumber(row.seq_scan),
    idxScan: asNumber(row.idx_scan),
  }));
};

const loadStatements = async (transaction: Transaction): Promise<StatementStat[]> => {
  const rows = await selectRows<{
    queryid: string;
    query: string;
    calls: string;
    total_exec_time: string;
    shared_blks_read: string;
  }>(`
    SELECT queryid::text AS queryid,
           min(query) AS query,
           sum(calls) AS calls,
           sum(total_exec_time) AS total_exec_time,
           sum(shared_blks_read) AS shared_blks_read
    FROM pg_stat_statements
    WHERE queryid IS NOT NULL
    GROUP BY queryid
  `, transaction);

  return rows.map((row) => ({
    queryid: String(row.queryid),
    query: String(row.query),
    calls: asNumber(row.calls),
    totalExecTimeMs: asNumber(row.total_exec_time),
    sharedBlksRead: asNumber(row.shared_blks_read),
  }));
};

const loadTables = async (transaction: Transaction): Promise<TableStat[]> => {
  const rows = await selectRows<{
    relname: string;
    seq_scan: string;
    idx_scan: string;
    n_live_tup: string;
  }>(`
    SELECT relname, seq_scan, COALESCE(idx_scan, 0) AS idx_scan, n_live_tup
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
  `, transaction);

  return rows.map((row) => ({
    relname: String(row.relname),
    seqScan: asNumber(row.seq_scan),
    idxScan: asNumber(row.idx_scan),
    liveRows: asNumber(row.n_live_tup),
  }));
};

const loadActiveQueries = async (transaction: Transaction): Promise<ActiveQuery[]> => {
  const rows = await selectRows<{
    duration_ms: string;
    wait_event_type: string | null;
    wait_event: string | null;
    query: string;
  }>(`
    SELECT
      EXTRACT(EPOCH FROM (clock_timestamp() - query_start)) * 1000 AS duration_ms,
      wait_event_type,
      wait_event,
      query
    FROM pg_stat_activity
    WHERE state = 'active'
      AND pid <> pg_backend_pid()
      AND query_start IS NOT NULL
      AND clock_timestamp() - query_start > interval '500 milliseconds'
  `, transaction);

  return rows.map((row) => ({
    durationMs: asNumber(row.duration_ms),
    waitEventType: row.wait_event_type == null ? null : String(row.wait_event_type),
    waitEvent: row.wait_event == null ? null : String(row.wait_event),
    query: String(row.query),
  }));
};

const replaceStatementSnapshots = async (rows: StatementStat[], transaction: Transaction): Promise<void> => {
  await sequelize.query('DELETE FROM slow_query_statement_snapshots', { transaction });
  if (rows.length === 0) {
    return;
  }
  const values = rows
    .map((row) => `(${sequelize.escape(row.queryid)}, ${row.calls}, ${row.totalExecTimeMs}, ${row.sharedBlksRead})`)
    .join(', ');
  await sequelize.query(
    `INSERT INTO slow_query_statement_snapshots (queryid, calls, total_exec_time, shared_blks_read) VALUES ${values}`,
    { transaction }
  );
};

const replaceTableSnapshots = async (rows: TableStat[], transaction: Transaction): Promise<void> => {
  await sequelize.query('DELETE FROM slow_query_table_snapshots', { transaction });
  if (rows.length === 0) {
    return;
  }
  const values = rows
    .map((row) => `(${sequelize.escape(row.relname)}, ${row.seqScan}, ${row.idxScan})`)
    .join(', ');
  await sequelize.query(
    `INSERT INTO slow_query_table_snapshots (relname, seq_scan, idx_scan) VALUES ${values}`,
    { transaction }
  );
};

const postToSlack = async (webhookUrl: string, text: string): Promise<void> => {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    throw new Error(`Slack webhook returned HTTP ${response.status}`);
  }
};

const extensionEnabled = async (): Promise<boolean> => {
  const rows = await selectRows<{ present: number }>(
    "SELECT 1 AS present FROM pg_extension WHERE extname = 'pg_stat_statements'"
  );
  return rows.length > 0;
};

const lockAcquired = async (transaction: Transaction): Promise<boolean> => {
  const rows = await selectRows<{ locked: boolean }>(
    `SELECT pg_try_advisory_xact_lock(${REPORT_LOCK_KEY}) AS locked`,
    transaction
  );
  return rows[0]?.locked === true;
};

/**
 * Compares Postgres stats with the last snapshot and posts slow queries to Slack.
 * The first run stores a baseline and does not alert on cumulative stats.
 * A second API instance skips the run while the lock is held.
 */
export const sendSlowQueryWebhookTest = async (): Promise<void> => {
  const webhookUrl = process.env.SLACK_SLOW_QUERY_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    throw new Error('SLACK_SLOW_QUERY_WEBHOOK_URL is required');
  }
  await postToSlack(webhookUrl, SLOW_QUERY_WEBHOOK_TEST_MESSAGE);
};

export const reportSlowQueries = async (): Promise<void> => {
  const webhookUrl = process.env.SLACK_SLOW_QUERY_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    throw new Error('SLACK_SLOW_QUERY_WEBHOOK_URL is required');
  }

  if (!(await extensionEnabled())) {
    throw new Error('pg_stat_statements is not installed. Enable it on the Railway Postgres service, restart Postgres, then run CREATE EXTENSION pg_stat_statements');
  }

  await ensureSnapshotTables();

  await sequelize.transaction(async (transaction) => {
    if (!(await lockAcquired(transaction))) {
      console.log('Slow query report skipped; another instance is running it');
      return;
    }

    const previousStatements = await loadStatementSnapshots(transaction);
    const previousTables = await loadTableSnapshots(transaction);
    const statements = await loadStatements(transaction);
    const tables = await loadTables(transaction);
    const activeQueries = await loadActiveQueries(transaction);

    const messages = [
      ...findSlowStatements(statements, previousStatements).slice(0, MAX_STATEMENT_POSTS).map(formatSlowStatementMessage),
      ...activeQueries
        .filter((query) => query.query.trim().length > 0 && !isIgnoredQuery(query.query))
        .slice(0, MAX_ACTIVE_POSTS)
        .map(formatActiveQueryMessage),
      ...findSequentialScanTables(tables, previousTables).slice(0, MAX_TABLE_POSTS).map(formatSequentialScanMessage),
    ];

    for (const message of messages) {
      await postToSlack(webhookUrl, message);
    }

    await replaceStatementSnapshots(statements, transaction);
    await replaceTableSnapshots(tables, transaction);
    console.log(`Posted ${messages.length} slow-query message(s). Snapshot stored.`);
  });
};
