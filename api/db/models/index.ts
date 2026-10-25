import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import { productionDatabaseSsl } from '../productionSsl.ts';

dotenv.config({ quiet: true });

let sequelize: Sequelize;

if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
  if (!process.env.DEV_DB_NAME || !process.env.DEV_DB_USER || !process.env.DEV_DB_PASSWORD || !process.env.DEV_DB_HOST || !process.env.DEV_DB_PORT) {
    throw new Error('Development database configuration is missing');
  }
  
  sequelize = new Sequelize(
    process.env.DEV_DB_NAME,
    process.env.DEV_DB_USER,
    process.env.DEV_DB_PASSWORD,
    {
      host: process.env.DEV_DB_HOST,
      port: parseInt(process.env.DEV_DB_PORT),
      dialect: 'postgres',
      logging: process.env.DEBUG === 'true' ? console.log : false,
    }
  );
} else {
  // Production configuration using DATABASE_URL
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production');
  }
  
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: productionDatabaseSsl(process.env.DATABASE_SSL_CA),
    },
    logging: process.env.DEBUG === 'true' ? console.log : false,
  });
}

export default sequelize;
