import express from 'express';
import type { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { initializeDatabase } from './db/db.ts';
import userRoutes from './routes/userRoutes.routes.ts';
import mealDiaryRoutes from './routes/mealDiary.routes.ts';
import familyGroupRoutes from './routes/familyGroups.routes.ts';
import shoppingListRoutes from './routes/shoppingList.routes.ts';
import authRoutes from './routes/auth.routes.ts';
import recipeRoutes from './routes/recipes.routes.ts';
import billingRoutes from './routes/billing.routes.ts';
import sseRoutes from './routes/sse.routes.ts';
import * as billingController from './controllers/billing/billing.controller.ts';
import { swaggerUi, specs } from './swagger.ts';
import path from 'path';
import { devCorsMiddleware } from './middleware/cors.middleware.ts';
import { swaggerBasicAuth } from './middleware/docsAuth.middleware.ts';
import { apiLimiter } from './middleware/rateLimit.middleware.ts';
import { getPostHog, shutdownPostHog } from './utils/posthog.ts';
import { initializeOtelLogs, shutdownOtelLogs, emitLog } from './utils/otelLogs.ts';
import { errorTrackingMiddleware } from './middleware/errorTracking.middleware.ts';
import { errorHandlerMiddleware } from './middleware/errorHandler.middleware.ts';
import { serverErrorLogMiddleware } from './middleware/serverErrorLog.middleware.ts';
import { startSlowQuerySchedule } from './services/slowQuerySchedule.ts';
import { sendSlowQueryWebhookTest } from './services/slowQueryReportRunner.ts';

const __dirname = path.resolve('./api');
const app = express();
const PORT = process.env.PORT || 3001;

app.disable('x-powered-by');
app.use(
  helmet({
    // JSON API + Swagger UI (swagger-ui-express needs inline script/style)
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'https:'],
      },
    },
  })
);

// Initialise PostHog analytics events
const posthog = getPostHog();
if (posthog) {
  console.log('PostHog initialized successfully');
} else if (process.env.NODE_ENV === 'production') {
  console.warn('PostHog: Not initialized - POSTHOG_KEY may be missing or invalid');
}

// Initialise PostHog Logs (OpenTelemetry)
initializeOtelLogs();

// Middleware
// Railway's public edge is one proxy and overwrites forwarding headers, so
// req.protocol and the hostname follow that hop. Rate limits do not use
// req.ip: the listen port is also reachable without the edge.
app.set('trust proxy', 1);

if (process.env.NODE_ENV === 'development') {
  app.use(devCorsMiddleware);
}

app.post('/billing/webhook', express.raw({ type: 'application/json' }), billingController.stripeWebhook);
app.post('/billing/revenuecat-webhook', express.json(), billingController.revenueCatWebhook);
app.use(express.json());
// Note on CSRF: this API does not use cookie-based authentication. All
// state-changing routes are protected by the `authenticateToken` middleware,
// which validates a JWT supplied via the `Authorization: Bearer <token>`
// header (see `middleware/auth.middleware.ts`). Browsers do not attach
// `Authorization` headers to cross-origin requests automatically, so the
// classic CSRF attack vector does not apply to these endpoints and a CSRF
// token middleware is not required.
//
// The only cookie this API issues is `oauth_state`, used during the Google
// OAuth 2.0 flow (see `controllers/auth/auth.controller.ts`). That cookie
// already implements its own CSRF protection: the value is compared against
// the `state` query parameter returned by Google, which is the standard
// OAuth 2.0 CSRF mitigation. The cookie is also `httpOnly`, `secure` in
// production, and `sameSite: 'lax'` (Strict would break the cross-site
// redirect back from Google).
app.use(cookieParser());

// Apply rate limiting to all routes
if (process.env.NODE_ENV !== 'development') {
  app.use(apiLimiter);
}

app.use(serverErrorLogMiddleware);

// Routes
app.use('/users', userRoutes);
app.use('/meal-diaries', mealDiaryRoutes);
app.use('/family-groups', familyGroupRoutes);
app.use('/shopping-list', shoppingListRoutes);
app.use('/auth', authRoutes);
app.use('/recipes', recipeRoutes);
app.use('/billing', billingRoutes);
app.use('/sse', sseRoutes);

// health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ message: 'OK' });
});

// Posts one test message through SLACK_SLOW_QUERY_WEBHOOK_URL.
// Same Basic Auth as /api-docs. Hidden when those credentials are unset.
app.post('/internal/slow-query-webhook-test', swaggerBasicAuth, async (_req: Request, res: Response) => {
  try {
    await sendSlowQueryWebhookTest();
    res.status(200).json({ message: 'Slack accepted the test message' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to post test message';
    const status = message.includes('SLACK_SLOW_QUERY_WEBHOOK_URL') ? 503 : 502;
    res.status(status).json({ message });
  }
});

// Swagger UI — Basic Auth via SWAGGER_USER / SWAGGER_PASSWORD (404 if unset)
app.use('/api-docs', swaggerBasicAuth, swaggerUi.serve, swaggerUi.setup(specs));

// server api test coverage (dev-only; do not ship coverage artifacts in production images)
if (process.env.NODE_ENV === 'development') {
  app.use('/coverage', express.static(path.join(__dirname, '../coverage')));
}

// Error tracking middleware (must be after routes)
app.use(errorTrackingMiddleware);
app.use(errorHandlerMiddleware);

// Initialize the database
(async () => {
  const dbInitialized = await initializeDatabase(false);
  
  if (dbInitialized) {
    try {
      const { backfillMealSlots } = await import('./services/mealSlots.service.ts');
      const result = await backfillMealSlots();
      console.log(
        `Meal slots backfill: ${result.familiesEnsured} families, ${result.entriesCreated} entries created`
      );
    } catch (error) {
      console.error('Meal slots backfill failed:', error);
      emitLog({
        severity: 'error',
        body: 'Meal slots backfill failed',
        attributes: { category: 'startup' },
      });
    }

    startSlowQuerySchedule();

    // Start the server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } else {
    console.error('Failed to initialize database, server not started');
    emitLog({
      severity: 'error',
      body: 'Database initialization failed',
      attributes: { category: 'startup' },
    });
  }
})();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await shutdownOtelLogs();
  await shutdownPostHog();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await shutdownOtelLogs();
  await shutdownPostHog();
  process.exit(0);
});
