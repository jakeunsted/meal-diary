export const SLOW_QUERY_MIN_MEAN_MS = 500;
export const SLOW_QUERY_MIN_CALLS = 5;
export const SEQUENTIAL_SCAN_MIN_DELTA = 50;
export const SEQUENTIAL_SCAN_MIN_LIVE_ROWS = 1000;
export const SLOW_QUERY_SQL_MAX_LENGTH = 1500;

/** Does not contain the slow-query marker, so a test post does not start an investigation. */
export const SLOW_QUERY_WEBHOOK_TEST_MESSAGE = [
  'webhook-test',
  'The Meal Diary slow query Slack webhook is configured.',
].join('\n');

const IGNORED_QUERY_FRAGMENTS = [
  'pg_stat_statements',
  'pg_stat_activity',
  'pg_stat_user_tables',
  'slow_query_statement_snapshots',
  'slow_query_table_snapshots',
];

export interface StatementStat {
  queryid: string;
  query: string;
  calls: number;
  totalExecTimeMs: number;
  sharedBlksRead: number;
}

export interface StatementSnapshot {
  queryid: string;
  calls: number;
  totalExecTimeMs: number;
  sharedBlksRead: number;
}

export interface SlowStatement {
  query: string;
  calls: number;
  meanExecTimeMs: number;
  sharedBlksRead: number;
}

export interface TableStat {
  relname: string;
  seqScan: number;
  idxScan: number;
  liveRows: number;
}

export interface TableSnapshot {
  relname: string;
  seqScan: number;
  idxScan: number;
}

export interface SequentialScanTable {
  relname: string;
  seqScan: number;
  idxScan: number;
  liveRows: number;
}

export interface ActiveQuery {
  durationMs: number;
  waitEventType: string | null;
  waitEvent: string | null;
  query: string;
}

export const isIgnoredQuery = (query: string): boolean => {
  const trimmed = query.trim();
  if (/^(SHOW|SET|BEGIN|COMMIT|ROLLBACK|CREATE|ALTER|DROP|DISCARD|DEALLOCATE|RESET)\b/i.test(trimmed)) {
    return true;
  }
  const lower = trimmed.toLowerCase();
  return IGNORED_QUERY_FRAGMENTS.some((fragment) => lower.includes(fragment));
};

export const redactQueryLiterals = (query: string): string => {
  const redacted = query.replace(/'(?:''|[^'])*'/g, "'?'");
  if (redacted.length <= SLOW_QUERY_SQL_MAX_LENGTH) {
    return redacted;
  }
  return `${redacted.slice(0, SLOW_QUERY_SQL_MAX_LENGTH)}…`;
};

/**
 * Queries whose average time since the last snapshot crossed the threshold.
 * An empty previous snapshot is a baseline, so nothing is reported.
 */
export const findSlowStatements = (
  current: StatementStat[],
  previous: StatementSnapshot[]
): SlowStatement[] => {
  if (previous.length === 0) {
    return [];
  }

  const previousById = new Map(previous.map((row) => [row.queryid, row]));
  const found: SlowStatement[] = [];

  for (const row of current) {
    if (isIgnoredQuery(row.query)) {
      continue;
    }

    const earlier = previousById.get(row.queryid);
    let calls = row.calls;
    let totalExecTimeMs = row.totalExecTimeMs;
    let sharedBlksRead = row.sharedBlksRead;

    if (earlier) {
      if (row.calls < earlier.calls || row.totalExecTimeMs < earlier.totalExecTimeMs) {
        continue;
      }
      calls = row.calls - earlier.calls;
      totalExecTimeMs = row.totalExecTimeMs - earlier.totalExecTimeMs;
      sharedBlksRead = Math.max(0, row.sharedBlksRead - earlier.sharedBlksRead);
    }

    if (calls < SLOW_QUERY_MIN_CALLS) {
      continue;
    }

    const meanExecTimeMs = totalExecTimeMs / calls;
    if (meanExecTimeMs < SLOW_QUERY_MIN_MEAN_MS) {
      continue;
    }

    found.push({
      query: redactQueryLiterals(row.query),
      calls,
      meanExecTimeMs,
      sharedBlksRead,
    });
  }

  found.sort((left, right) => right.meanExecTimeMs - left.meanExecTimeMs);
  return found;
};

/**
 * Tables that sequential-scanned often since the last snapshot and barely used an index.
 * An empty previous snapshot is a baseline, so nothing is reported.
 */
export const findSequentialScanTables = (
  current: TableStat[],
  previous: TableSnapshot[]
): SequentialScanTable[] => {
  if (previous.length === 0) {
    return [];
  }

  const previousByName = new Map(previous.map((row) => [row.relname, row]));
  const found: SequentialScanTable[] = [];

  for (const row of current) {
    if (row.liveRows < SEQUENTIAL_SCAN_MIN_LIVE_ROWS) {
      continue;
    }

    const earlier = previousByName.get(row.relname);
    let seqScan = row.seqScan;
    let idxScan = row.idxScan;

    if (earlier) {
      if (row.seqScan < earlier.seqScan || row.idxScan < earlier.idxScan) {
        continue;
      }
      seqScan = row.seqScan - earlier.seqScan;
      idxScan = row.idxScan - earlier.idxScan;
    }

    if (seqScan < SEQUENTIAL_SCAN_MIN_DELTA) {
      continue;
    }
    if (idxScan * 10 >= seqScan) {
      continue;
    }

    found.push({
      relname: row.relname,
      seqScan,
      idxScan,
      liveRows: row.liveRows,
    });
  }

  found.sort((left, right) => right.seqScan - left.seqScan);
  return found;
};

const formatMs = (durationMs: number): string => {
  if (durationMs >= 1000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }
  return `${Math.round(durationMs)}ms`;
};

export const formatSlowStatementMessage = (statement: SlowStatement): string => {
  return [
    'slow-query',
    `mean ${formatMs(statement.meanExecTimeMs)} over ${statement.calls} calls since the last check`,
    `shared blocks read: ${statement.sharedBlksRead}`,
    '',
    redactQueryLiterals(statement.query),
  ].join('\n');
};

export const formatActiveQueryMessage = (query: ActiveQuery): string => {
  const wait = [query.waitEventType, query.waitEvent].filter(Boolean).join(' / ');
  return [
    'slow-query',
    `still running for ${formatMs(query.durationMs)}`,
    `wait: ${wait || 'none'}`,
    '',
    redactQueryLiterals(query.query),
  ].join('\n');
};

export const formatSequentialScanMessage = (table: SequentialScanTable): string => {
  return [
    'slow-query',
    `table "${table.relname}" sequential scans: ${table.seqScan} since the last check, index scans: ${table.idxScan}, live rows: ${table.liveRows}`,
  ].join('\n');
};
