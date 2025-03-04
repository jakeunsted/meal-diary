import express from 'express';
import { initializeDatabase } from './db/db.ts';
import userRoutes from './routes/userRoutes.routes.ts';
import mealDiaryRoutes from './routes/mealDiary.routes.ts';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/meal-diaries', mealDiaryRoutes);

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
