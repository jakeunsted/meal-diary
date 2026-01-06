import express from 'express';
import type { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { initializeDatabase } from './db/db.ts';
import userRoutes from './routes/userRoutes.routes.ts';
import mealDiaryRoutes from './routes/mealDiary.routes.ts';
import familyGroupRoutes from './routes/familyGroups.routes.ts';
import shoppingListRoutes from './routes/shoppingList.routes.ts';
import authRoutes from './routes/auth.routes.ts';
import itemCategoriesRoutes from './routes/itemCategories.routes.ts';
import { swaggerUi, specs } from './swagger.ts';
import path from 'path';
import { apiLimiter } from './middleware/rateLimit.middleware.ts';
import { getPostHog, shutdownPostHog } from './utils/posthog.ts';

const __dirname = path.resolve('./api');
const app = express();
const PORT = process.env.PORT || 3001;

// Initialise PostHog
const posthog = getPostHog();
if (posthog) {
  console.log('PostHog initialized successfully');
} else if (process.env.NODE_ENV === 'production') {
  console.warn('PostHog: Not initialized - POSTHOG_KEY may be missing or invalid');
}

// Middleware
// Trust proxy for Railway (needed for rate limiting and correct IP addresses)
// Railway uses 1 proxy, so we trust only the first proxy
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());

// Apply rate limiting to all routes
if (process.env.NODE_ENV !== 'development') {
  app.use(apiLimiter);
}

// Routes
app.use('/users', userRoutes);
app.use('/meal-diaries', mealDiaryRoutes);
app.use('/family-groups', familyGroupRoutes);
app.use('/shopping-list', shoppingListRoutes);
app.use('/auth', authRoutes);
app.use('/item-categories', itemCategoriesRoutes);

// health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ message: 'OK' });
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// server api test coverage
app.use('/coverage', express.static(path.join(__dirname, '../coverage')));

// Initialize the database
(async () => {
  const dbInitialized = await initializeDatabase(false);
  
  if (dbInitialized) {
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } else {
    console.error('Failed to initialize database, server not started');
  }
})();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await shutdownPostHog();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await shutdownPostHog();
  process.exit(0);
});
