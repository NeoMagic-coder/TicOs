-- Ticosclaw initial schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  plan TEXT NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  url TEXT,
  voice_profile JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(brand_id, role)
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE content_ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  platforms TEXT[] DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  content JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  credentials JSONB DEFAULT '{}',
  is_connected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(brand_id, platform)
);

CREATE TABLE generated_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  image_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  unit TEXT,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usage_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  limit_count INTEGER NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL DEFAULT (DATE_TRUNC('day', NOW()) + INTERVAL '1 day'),
  UNIQUE(user_id, feature)
);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_self ON users FOR ALL USING (id = auth.uid()::text);
CREATE POLICY brands_owner ON brands FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY conversations_owner ON conversations FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY usage_owner ON usage_limits FOR ALL USING (user_id = auth.uid()::text);

CREATE POLICY team_members_via_brand ON team_members FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()::text));
CREATE POLICY content_ideas_via_brand ON content_ideas FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()::text));
CREATE POLICY automations_via_brand ON automations FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()::text));
CREATE POLICY integrations_via_brand ON integrations FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()::text));
CREATE POLICY generated_images_via_brand ON generated_images FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()::text));
CREATE POLICY goals_via_brand ON goals FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()::text));

-- Indexes
CREATE INDEX idx_brands_user ON brands(user_id);
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_content_ideas_brand ON content_ideas(brand_id);
CREATE INDEX idx_content_ideas_scheduled ON content_ideas(scheduled_at);
CREATE INDEX idx_integrations_brand ON integrations(brand_id);
