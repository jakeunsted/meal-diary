import cron from 'node-cron';
import { reportSlowQueries } from './slowQueryReportRunner.ts';

/**
 * Runs the slow-query report at the top of each hour in production.
 * Stays off unless SLACK_SLOW_QUERY_WEBHOOK_URL is set, so local dev does not post to Slack.
 */
export const startSlowQuerySchedule = (): void => {
  const webhookUrl = process.env.SLACK_SLOW_QUERY_WEBHOOK_URL?.trim();
  if (process.env.NODE_ENV !== 'production' || !webhookUrl) {
    return;
  }

  cron.schedule('0 * * * *', () => {
    reportSlowQueries().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Slow query report failed: ${message}`);
    });
  }, { timezone: 'UTC' });

  console.log('Slow query report scheduled hourly');
};
