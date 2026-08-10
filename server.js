import express from 'express';
import { handleRedirect } from './src/handleRedirect.js';
import { initializeDatabase } from './config/db.js';

const app = express();

app.get('/r', handleRedirect);

const PORT = process.env.PORT || 3000;

// Initialize DB first, THEN start listening
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Fast-Redirect server listening on port ${PORT}`);
  });
}).catch(err => {
  console.error("Failed to start server due to DB init error:", err);
});