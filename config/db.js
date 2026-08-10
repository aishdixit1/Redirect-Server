import pg from 'pg';
import dotenv from 'dotenv';
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { createContactsSchema } from '../src/schema/contacts.js';
import { createBroadcastsSchema } from '../src/schema/broadcasts.js';
import { createMessagesSchema } from '../src/schema/messages.js';
import { createClicksSchema } from '../src/schema/clicks.js';

// Load environment variables first
dotenv.config();

const { Pool, Client } = pg;

const region = "ap-south-1";
const secretName = process.env.DB_SECRET;

const secretsClient = new SecretsManagerClient({ region });

let pool;

/**
 * Fetches the latest credentials from AWS Secrets Manager.
 * This ensures DB_PASSWORD is never hardcoded.
 */
async function getRemoteConfig() {
  try {
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    const secrets = JSON.parse(response.SecretString);

    const isLocalTunnel = process.env.DB_HOST === 'localhost';
    console.log("🛠️ DB Host:", process.env.DB_HOST || "UNDEFINED - Warning: pg will default to localhost!");
    console.log("🛠️ DB User:", secrets.username);
    console.log("🛠️ Has Password?", !!secrets.password);
    return {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || secrets.port || 5432,
      user: process.env.DB_USER || secrets.username,
      password: process.env.DB_PASSWORD || secrets.password,
      database: process.env.DB_NAME || secrets.dbname || 'chatdb',
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false } // This fixes the SSL issue!
    };

  } catch (error) {
    console.error("Critical: Could not retrieve secrets from AWS", error);
    throw error;
  }
}

/**
 * Ensures the target database exists by connecting to the default 'postgres' db first.
 */
async function ensureDatabaseExists(config) {
  const adminClient = new Client({
    ...config,
    database: 'postgres',
  });

  try {
    await adminClient.connect();
    const result = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [config.database]
    );

    if (result.rows.length === 0) {
      console.log(`Database '${config.database}' does not exist. Creating...`);
      await adminClient.query(`CREATE DATABASE "${config.database}"`);
      console.log(`Database '${config.database}' created successfully`);
    } else {
      console.log(`Database '${config.database}' already exists`);
    }
  } catch (error) {
    console.error('Error checking/creating database:', error.message);
    throw error;
  } finally {
    await adminClient.end();
  }
}

/**
 * Main initialization sequence
 */
export async function initializeDatabase() {
  try {
    const dbConfig = await getRemoteConfig();
    await ensureDatabaseExists(dbConfig);

    pool = new Pool({
      ...dbConfig,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('connect', () => {
      console.log('Connected to RDS PostgreSQL database');
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });

    await initializeSchema();

  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }
}

// Initialize database schema
async function initializeSchema() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Enable UUID extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        uid INTEGER PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        business_name VARCHAR(255),
        business_type VARCHAR(100),
        signup_mobile_number VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Users alter script
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'business_name') THEN
          ALTER TABLE users ADD COLUMN business_name VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'business_type') THEN
          ALTER TABLE users ADD COLUMN business_type VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'signup_mobile_number') THEN
          ALTER TABLE users ADD COLUMN signup_mobile_number VARCHAR(50);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'waba_details') THEN
          ALTER TABLE users ADD COLUMN waba_details JSONB;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'members_count') THEN
          ALTER TABLE users ADD COLUMN members_count INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'members_limit') THEN
          ALTER TABLE users ADD COLUMN members_limit INTEGER DEFAULT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'templates') THEN
          ALTER TABLE users ADD COLUMN templates JSONB DEFAULT '[]'::jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'shopify_domain') THEN
          ALTER TABLE users ADD COLUMN shopify_domain VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'shopify_access_token') THEN
          ALTER TABLE users ADD COLUMN shopify_access_token VARCHAR(255);
        END IF;
      END $$;
    `);

    // Teams & Members
    await client.query(`
      CREATE TABLE IF NOT EXISTS teams (
        team_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id INTEGER NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const ownerIdType = await client.query(`
      SELECT data_type FROM information_schema.columns 
      WHERE table_name = 'teams' AND column_name = 'owner_id'
    `);

    if (ownerIdType.rows.length > 0 && ownerIdType.rows[0].data_type === 'uuid') {
      const rowCount = await client.query('SELECT COUNT(*) FROM teams');
      if (parseInt(rowCount.rows[0].count) > 0) {
        await client.query('DROP TABLE IF EXISTS team_members CASCADE');
        await client.query('DROP TABLE IF EXISTS teams CASCADE');
        await client.query(`
          CREATE TABLE teams (
            team_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_id INTEGER NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          )
        `);
      } else {
        await client.query(`
          DO $$
          BEGIN
            ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_owner_id_fkey;
            ALTER TABLE teams ALTER COLUMN owner_id TYPE INTEGER USING NULL;
            ALTER TABLE teams ADD CONSTRAINT teams_owner_id_fkey 
              FOREIGN KEY (owner_id) REFERENCES users(uid) ON DELETE CASCADE;
          END $$;
        `);
      }
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        member_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        role VARCHAR(50),
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (team_id, email)
      )
    `);

    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'member_id') THEN
          ALTER TABLE team_members ADD COLUMN member_id UUID DEFAULT gen_random_uuid();
          ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_pkey;
          ALTER TABLE team_members ADD PRIMARY KEY (member_id);
          ALTER TABLE team_members ADD CONSTRAINT team_members_team_id_email_key UNIQUE (team_id, email);
        END IF;
      END $$;
    `);

    // Messages
    const hasConversationId = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'conversation_id'
    `);

    if (hasConversationId.rows.length > 0) {
      await client.query('DROP TABLE IF EXISTS messages CASCADE');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        sender_name VARCHAR(100) NOT NULL,
        sender_number VARCHAR(50),
        message TEXT NOT NULL,
        content TEXT,
        time_stamp BIGINT,
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        message_type VARCHAR(50) DEFAULT 'user'
      )
    `);

    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'direction') THEN
          ALTER TABLE messages ADD COLUMN direction VARCHAR(20) DEFAULT 'outbound';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'status') THEN
          ALTER TABLE messages ADD COLUMN status VARCHAR(20) DEFAULT 'sent';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'message_metadata') THEN
          ALTER TABLE messages ADD COLUMN message_metadata JSONB DEFAULT '{}'::jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'wamid') THEN
          ALTER TABLE messages ADD COLUMN wamid VARCHAR(255);
          ALTER TABLE messages ADD CONSTRAINT messages_wamid_unique UNIQUE (wamid);
        END IF;
      END $$;
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_wamid ON messages(wamid)`);

    // ==========================================
    // EXTERNAL SCHEMAS
    // ==========================================
    await createContactsSchema(client);
    await createBroadcastsSchema(client); // 👈 Trigger external broadcast setup
    await createMessagesSchema(client);
    await createClicksSchema(client);

    // Audience Builder
    await client.query(`
      CREATE TABLE IF NOT EXISTS audience_lists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        rules_json JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audience_list_contacts (
        list_id UUID NOT NULL REFERENCES audience_lists(id) ON DELETE CASCADE,
        contact_id UUID NOT NULL REFERENCES contacts(contact_id) ON DELETE CASCADE,
        PRIMARY KEY (list_id, contact_id)
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_audience_list_contacts_list_id ON audience_list_contacts(list_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email)`);

    // Invitations
    await client.query(`
      CREATE TABLE IF NOT EXISTS invitations (
        invitation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invited_email VARCHAR(100) NOT NULL,
        team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
        inviter_user_id INTEGER NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Expired')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        accepted_at TIMESTAMP WITH TIME ZONE,
        name VARCHAR(255),
        role VARCHAR(50)
      )
    `);

    await client.query(`ALTER TABLE invitations ADD COLUMN IF NOT EXISTS name VARCHAR(255)`);
    await client.query(`ALTER TABLE invitations ADD COLUMN IF NOT EXISTS role VARCHAR(50)`);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(invited_email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_invitations_team_id ON invitations(team_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_templates ON users USING GIN (templates)`);

    // User Media
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_media (
        media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_length BIGINT NOT NULL,
        meta_upload_id TEXT NOT NULL,
        meta_file_handle TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_media_user_id ON user_media(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_media_created_at ON user_media(created_at)`);

    // Templates
    await client.query(`
      CREATE TABLE IF NOT EXISTS templates (
        template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        name VARCHAR(255),
        category VARCHAR(100),
        language VARCHAR(50),
        template_status VARCHAR(50) DEFAULT 'draft',
        object JSONB NOT NULL,
        media_id UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id)`);

    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'templates' AND column_name = 'meta_template_id') THEN
          ALTER TABLE templates ADD COLUMN meta_template_id VARCHAR(255);
        END IF;
      END $$;
    `);

    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_meta_id ON templates(meta_template_id)`);

    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_media' AND column_name = 's3_key') THEN
          ALTER TABLE user_media ADD COLUMN s3_key VARCHAR(255);
          ALTER TABLE user_media ADD COLUMN s3_url TEXT;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_media' AND column_name = 'file_data') THEN
          ALTER TABLE user_media DROP COLUMN file_data;
        END IF;
      END $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'templates_media_id_fkey'
        ) THEN
          ALTER TABLE templates 
          ADD CONSTRAINT templates_media_id_fkey 
          FOREIGN KEY (media_id) REFERENCES user_media(media_id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await client.query('COMMIT');
    console.log('✅ Database schema initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing database schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

export const db = {
  query: (text, params) => {
    if (!pool) throw new Error("Database pool not initialized.");
    return pool.query(text, params);
  },
  getClient: async () => {
    if (!pool) throw new Error("Database pool not initialized.");
    return await pool.connect();
  },
  end: () => {
    if (pool) return pool.end();
  }
};