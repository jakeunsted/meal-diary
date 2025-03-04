import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

let dbName: string | undefined;
let dbUser: string | undefined;
let dbPassword: string | undefined;
let dbHost: string | undefined;
let dbPort: string | undefined;

if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
  if (!process.env.DEV_DB_NAME || !process.env.DEV_DB_USER || !process.env.DEV_DB_PASSWORD || !process.env.DEV_DB_HOST || !process.env.DEV_DB_PORT) {
    throw new Error('Development database configuration is missing');
  }
  dbName = process.env.DEV_DB_NAME;
  dbUser = process.env.DEV_DB_USER;
  dbPassword = process.env.DEV_DB_PASSWORD;
  dbHost = process.env.DEV_DB_HOST;
  dbPort = process.env.DEV_DB_PORT;
} else {
  if (!process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_HOST || !process.env.DB_PORT) {
    throw new Error('Database configuration is missing');
  }
  dbName = process.env.DB_NAME;
  dbUser = process.env.DB_USER;
  dbPassword = process.env.DB_PASSWORD;
  dbHost = process.env.DB_HOST;
  dbPort = process.env.DB_PORT;
}

const sequelize = new Sequelize(
  dbName,
  dbUser,
  dbPassword,
  {
    host: dbHost,
    port: parseInt(dbPort),
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  }
);

export default sequelize;
