import express from 'express';
import { initializeDatabase } from './db/db.ts';
import userRoutes from './routes/userRoutes.routes.ts';
import mealDiaryRoutes from './routes/mealDiary.routes.ts';
import familyGroupRoutes from './routes/familyGroups.routes.ts';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Routes
app.use('/users', userRoutes);
app.use('/meal-diaries', mealDiaryRoutes);
app.use('/family-groups', familyGroupRoutes);

// health check
app.get('/health', (req, res) => {
  res.status(200).json({ message: 'OK' });
});

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
