import express from 'express';
import { handleRedirect } from './src/handleRedirect.js';
const app = express();

app.get('/r', handleRedirect);

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Fast-Redirect server listening on port ${PORT}`);
});