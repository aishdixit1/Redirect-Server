// schema/clicks.js

export const createClicksSchema = async (client) => {
  try {
    console.log('Initializing clicks schema...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS clicks (
        click_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        broadcast_id UUID REFERENCES broadcasts(broadcast_id) ON DELETE CASCADE,
        contact_id UUID REFERENCES contacts(contact_id) ON DELETE CASCADE,
        button_clicked VARCHAR(255),
        clicked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_clicks_broadcast_id ON clicks(broadcast_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_clicks_contact_id ON clicks(contact_id)`);

    console.log('Clicks schema initialized successfully');
  } catch (error) {
    console.error('Error initializing clicks schema:', error);
    throw error;
  }
};
