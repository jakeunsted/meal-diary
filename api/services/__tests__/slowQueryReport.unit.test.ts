import { describe, expect, it } from 'vitest';
import {
  findSequentialScanTables,
  findSlowStatements,
  formatActiveQueryMessage,
  formatSequentialScanMessage,
  formatSlowStatementMessage,
  SLOW_QUERY_WEBHOOK_TEST_MESSAGE,
  type StatementStat,
  type TableStat,
} from '../slowQueryReport.ts';

const statement = (overrides: Partial<StatementStat> = {}): StatementStat => ({
  queryid: '1',
  query: 'SELECT * FROM "DailyMeals" WHERE id = $1',
  calls: 10,
  totalExecTimeMs: 8000,
  sharedBlksRead: 40,
  ...overrides,
});

describe('findSlowStatements', () => {
  it('stores a baseline when there is no previous snapshot', () => {
    expect(findSlowStatements([statement()], [])).toEqual([]);
  });

  it('reports a query whose average since the last snapshot is over 500ms', () => {
    const found = findSlowStatements(
      [statement({ calls: 20, totalExecTimeMs: 14000, sharedBlksRead: 55 })],
      [{ queryid: '1', calls: 10, totalExecTimeMs: 2000, sharedBlksRead: 10 }]
    );

    expect(found).toEqual([
      {
        query: 'SELECT * FROM "DailyMeals" WHERE id = $1',
        calls: 10,
        meanExecTimeMs: 1200,
        sharedBlksRead: 45,
      },
    ]);
  });

  it('skips a query that ran fewer than five times in the window', () => {
    const found = findSlowStatements(
      [statement({ calls: 14, totalExecTimeMs: 9000 })],
      [{ queryid: '1', calls: 10, totalExecTimeMs: 1000, sharedBlksRead: 0 }]
    );

    expect(found).toEqual([]);
  });

  it('skips a query whose counters went backwards', () => {
    const found = findSlowStatements(
      [statement({ calls: 2, totalExecTimeMs: 4000 })],
      [{ queryid: '1', calls: 10, totalExecTimeMs: 1000, sharedBlksRead: 0 }]
    );

    expect(found).toEqual([]);
  });

  it('reports a new query id against the existing baseline', () => {
    const found = findSlowStatements(
      [statement({ queryid: '9', calls: 6, totalExecTimeMs: 6000, sharedBlksRead: 3 })],
      [{ queryid: '1', calls: 10, totalExecTimeMs: 1000, sharedBlksRead: 0 }]
    );

    expect(found).toHaveLength(1);
    expect(found[0]?.calls).toBe(6);
    expect(found[0]?.meanExecTimeMs).toBe(1000);
  });

  it('ignores the stats queries this job runs', () => {
    const found = findSlowStatements(
      [statement({ query: 'SELECT queryid FROM pg_stat_statements', calls: 20, totalExecTimeMs: 20000 })],
      [{ queryid: '1', calls: 1, totalExecTimeMs: 1, sharedBlksRead: 0 }]
    );

    expect(found).toEqual([]);
  });
});

describe('findSequentialScanTables', () => {
  const table = (overrides: Partial<TableStat> = {}): TableStat => ({
    relname: 'DailyMeals',
    seqScan: 80,
    idxScan: 1,
    liveRows: 5000,
    ...overrides,
  });

  it('reports a large table that sequential-scanned without using an index', () => {
    const found = findSequentialScanTables(
      [table({ seqScan: 200, idxScan: 4 })],
      [{ relname: 'DailyMeals', seqScan: 100, idxScan: 2 }]
    );

    expect(found).toEqual([
      { relname: 'DailyMeals', seqScan: 100, idxScan: 2, liveRows: 5000 },
    ]);
  });

  it('skips a small table and a table that also used an index', () => {
    const found = findSequentialScanTables(
      [
        table({ relname: 'Small', liveRows: 10, seqScan: 400, idxScan: 0 }),
        table({ relname: 'Indexed', seqScan: 200, idxScan: 80 }),
      ],
      [
        { relname: 'Small', seqScan: 0, idxScan: 0 },
        { relname: 'Indexed', seqScan: 0, idxScan: 0 },
      ]
    );

    expect(found).toEqual([]);
  });
});

describe('Slack messages', () => {
  it('keeps the webhook test text off the slow-query marker', () => {
    expect(SLOW_QUERY_WEBHOOK_TEST_MESSAGE.startsWith('webhook-test')).toBe(true);
    expect(SLOW_QUERY_WEBHOOK_TEST_MESSAGE.includes('slow-query')).toBe(false);
  });

  it('prefixes each finding with slow-query and strips quoted literals', () => {
    const statementMessage = formatSlowStatementMessage({
      query: "SELECT * FROM users WHERE email = 'a@b.com'",
      calls: 8,
      meanExecTimeMs: 1500,
      sharedBlksRead: 12,
    });
    const activeMessage = formatActiveQueryMessage({
      durationMs: 2400,
      waitEventType: 'Lock',
      waitEvent: 'relation',
      query: "UPDATE users SET name = 'secret' WHERE id = $1",
    });
    const tableMessage = formatSequentialScanMessage({
      relname: 'DailyMeals',
      seqScan: 80,
      idxScan: 1,
      liveRows: 5000,
    });

    expect(statementMessage.startsWith('slow-query')).toBe(true);
    expect(statementMessage).toContain("email = '?'");
    expect(statementMessage).not.toContain('a@b.com');
    expect(activeMessage).toContain('still running for 2.4s');
    expect(activeMessage).toContain('wait: Lock / relation');
    expect(activeMessage).not.toContain('secret');
    expect(tableMessage.startsWith('slow-query')).toBe(true);
    expect(tableMessage).toContain('DailyMeals');
  });
});
