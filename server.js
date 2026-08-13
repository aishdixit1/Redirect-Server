import express from 'express';
import { handleRedirect } from './src/handleRedirect.js';
import { initializeDatabase } from './config/db.js';
import { getBroadcastClicks, getContactClicks } from './src/controllers/clicksController.js';

const app = express();

app.use(express.json());

// Redirection Endpoint
app.get('/r', handleRedirect);

// Click Analytics API Endpoints
app.get('/api/clicks/broadcast/:broadcast_id', getBroadcastClicks);
app.get('/api/clicks/contact/:contact_id', getContactClicks);

const PORT = process.env.PORT || 3000;

// Initialize DB first, THEN start listening
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Fast-Redirect server listening on port ${PORT}`);
  });
}).catch(err => {
  console.error("Failed to start server due to DB init error:", err);
});