// schema/messages.js

export const createMessagesSchema = async (client) => {
  try {
    console.log('Initializing messages schema...');

    // Removed the drop statement to avoid wiping data on every init
    // await client.query('DROP TABLE IF EXISTS messages CASCADE');

    // Consolidated Create Table Query
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        broadcast_id UUID REFERENCES broadcasts(broadcast_id) ON DELETE SET NULL,
        sender_name VARCHAR(100),
        sender_number VARCHAR(50),
        message TEXT,
        content TEXT,
        time_stamp BIGINT,
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        message_type VARCHAR(50) DEFAULT 'user',
        direction VARCHAR(20) DEFAULT 'outbound',
        status VARCHAR(20) DEFAULT 'sent',
        message_metadata JSONB DEFAULT '{}'::jsonb,
        wamid VARCHAR(255) UNIQUE
      )
    `);

    // Create Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_wamid ON messages(wamid)`);

    // Ensure legacy constraints are removed without dropping the table
    await client.query(`ALTER TABLE messages ALTER COLUMN message DROP NOT NULL`);
    await client.query(`ALTER TABLE messages ALTER COLUMN sender_name DROP NOT NULL`);

    console.log('✅ Messages schema initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing messages schema:', error);
    throw error;
  }
};