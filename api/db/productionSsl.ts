export interface ProductionDatabaseSsl {
  require: true;
  rejectUnauthorized: true;
  ca: string;
}

export function productionDatabaseSsl(caFromEnv: string | undefined): ProductionDatabaseSsl {
  const ca = caFromEnv?.replace(/\\n/g, '\n').trim();
  if (!ca?.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----')) {
    throw new Error('DATABASE_SSL_CA is required in production');
  }

  return {
    require: true,
    rejectUnauthorized: true,
    ca,
  };
}
