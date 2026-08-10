// schema/Broadcasts.js

export async function createBroadcastsSchema(client) {
  try {
    // 1. Create the broadcast status ENUM
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'broadcast_status') THEN
          CREATE TYPE broadcast_status AS ENUM ('draft', 'processing', 'completed', 'failed', 'cancelled');
        END IF;
      END $$;
    `);

    // 2. Create the main broadcasts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS broadcasts (
        broadcast_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        template_id UUID NOT NULL,
        audience_list_id UUID NOT NULL,
        status broadcast_status DEFAULT 'processing',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Add Analytics Columns to the Broadcasts Table
    // These prepare your production DB to receive the real calculations later.
    await client.query(`
      DO $$ 
      BEGIN
        -- Financials
        ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS attributed_revenue DECIMAL(10,2) DEFAULT 0.00;
        ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS campaign_cost DECIMAL(10,2) DEFAULT 0.00;
        ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS roas DECIMAL(10,2) DEFAULT 0.00;
        ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(5,2) DEFAULT 0.00;
        
        -- Message Funnel
        ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS messages_sent INTEGER DEFAULT 0;
        ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS messages_delivered INTEGER DEFAULT 0;
        ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS messages_read INTEGER DEFAULT 0;
        ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS messages_clicked INTEGER DEFAULT 0;
        ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS messages_converted INTEGER DEFAULT 0;
        ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS messages_bounced INTEGER DEFAULT 0;
        
        -- Order Types & Quality
        ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS prepaid_orders INTEGER DEFAULT 0;
        ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS cod_orders INTEGER DEFAULT 0;
        ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS phone_quality_score DECIMAL(5,2) DEFAULT 100.00;
      EXCEPTION
        WHEN duplicate_column THEN null;
      END $$;
    `);

    // 4. Message Alterations for Broadcasts
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'broadcast_id') THEN
          ALTER TABLE messages ADD COLUMN broadcast_id UUID REFERENCES broadcasts(broadcast_id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'contact_id') THEN
          ALTER TABLE messages ADD COLUMN contact_id UUID REFERENCES contacts(contact_id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'error_reason') THEN
          ALTER TABLE messages ADD COLUMN error_reason TEXT;
        END IF;
      END $$;
    `);

    // 5. Indexes for performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_broadcast_id ON messages(broadcast_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_wamid ON messages(wamid)`);

    console.log('✅ Broadcasts schema initialized (Production-Ready)');
  } catch (error) {
    console.error('❌ Error initializing broadcasts schema:', error);
    throw error;
  }
}