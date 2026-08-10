export const createContactsSchema = async (client) => {
  // 1. The Upgraded Contacts Table
  await client.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      contact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id INTEGER NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
      
      shopify_customer_id VARCHAR(255),
      phone_number VARCHAR(50),
      email VARCHAR(255),
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      
      -- Campaign/Tier Routing Metrics
      total_spent DECIMAL(10, 2) DEFAULT 0.00,
      order_count INTEGER DEFAULT 0,
      last_order_date TIMESTAMP WITH TIME ZONE,
      city VARCHAR(100),
      country VARCHAR(100),
      
      -- WhatsApp Compliance & Meta
      whatsapp_mkt_opt_in BOOLEAN DEFAULT false,
      mkt_opt_in_date TIMESTAMP WITH TIME ZONE,
      status VARCHAR(20) DEFAULT 'active',
      
      type VARCHAR(50),
      tags TEXT[] DEFAULT '{}',
      source VARCHAR(100),
      last_interacted_at TIMESTAMP WITH TIME ZONE,
      
      custom_attributes JSONB DEFAULT '{}'::jsonb,
      
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      
      UNIQUE(user_id, phone_number)
    );
  `);

  // 2. The Orders Table (For Tier 2 Campaigns)
  await client.query(`
    CREATE TABLE IF NOT EXISTS orders (
      order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shopify_order_id VARCHAR(255) UNIQUE NOT NULL,
      contact_id UUID REFERENCES contacts(contact_id) ON DELETE CASCADE,
      total_price DECIMAL(10, 2) NOT NULL,
      status VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. The Order Line Items Table (For Tier 3 & 4 AI Campaigns)
  await client.query(`
    CREATE TABLE IF NOT EXISTS order_line_items (
      line_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE,
      contact_id UUID REFERENCES contacts(contact_id) ON DELETE CASCADE,
      product_id VARCHAR(255),
      product_name VARCHAR(255),
      category_name VARCHAR(100),
      quantity INTEGER DEFAULT 1
    );
  `);

  // 4. Performance Indexes for Audience Segmentation
  await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_custom_attributes ON contacts USING GIN (custom_attributes);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN (tags);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_contact_id ON orders(contact_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_line_items_category ON order_line_items(category_name);`);

  console.log('✅ Contacts & Shopify schema successfully loaded.');
};