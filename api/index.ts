import express from 'express';
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

const __dirname = path.resolve('./api');
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Apply rate limiting to all routes
app.use(apiLimiter);

// Routes
app.use('/users', userRoutes);
app.use('/meal-diaries', mealDiaryRoutes);
app.use('/family-groups', familyGroupRoutes);
app.use('/shopping-list', shoppingListRoutes);
app.use('/auth', authRoutes);
app.use('/item-categories', itemCategoriesRoutes);

// health check
app.get('/health', (req, res) => {
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
