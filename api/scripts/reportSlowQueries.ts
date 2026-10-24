import sequelize from '../db/models/index.ts';
import { reportSlowQueries } from '../services/slowQueryReportRunner.ts';

reportSlowQueries()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    await sequelize.close();
    process.exit(1);
  });
