-- SOTA 2026 Upgrades for Tenant Experience
-- Includes Rewards, KYC Status, Open Banking integration and Energy Sync

-- 1. Extend tenant_profiles with SOTA columns
ALTER TABLE tenant_profiles 
ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'processing', 'verified', 'rejected')),
ADD COLUMN IF NOT EXISTS open_banking_connected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS credit_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;

-- 2. Create tenant_rewards table
CREATE TABLE IF NOT EXISTS tenant_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    action_type TEXT NOT NULL, -- 'rent_paid_on_time', 'energy_saving', 'profile_completed'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create energy_sync_logs for IoT integration
CREATE TABLE IF NOT EXISTS energy_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    meter_id UUID REFERENCES meters(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'enedis', 'grdf'
    status TEXT NOT NULL, -- 'success', 'failed'
    data JSONB,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create marketplace_offers table
CREATE TABLE IF NOT EXISTS marketplace_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL, -- 'insurance', 'energy', 'internet'
    provider_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    discount_text TEXT,
    cta_url TEXT,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RLS Policies
ALTER TABLE tenant_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_offers ENABLE ROW LEVEL SECURITY;

-- Tenant can see their own rewards
CREATE POLICY "Tenants can view their own rewards" ON tenant_rewards
    FOR SELECT USING (auth.uid() IN (SELECT user_id FROM profiles WHERE id = profile_id));

-- Tenant can see energy logs for their properties
CREATE POLICY "Tenants can view energy logs" ON energy_sync_logs
    FOR SELECT USING (
        auth.uid() IN (
            SELECT p.user_id FROM profiles p 
            JOIN lease_signers ls ON ls.profile_id = p.id
            JOIN leases l ON l.id = ls.lease_id
            WHERE l.property_id = energy_sync_logs.property_id
        )
    );

-- Everyone can see active marketplace offers
CREATE POLICY "Anyone can view active marketplace offers" ON marketplace_offers
    FOR SELECT USING (is_active = true);

-- 6. Trigger to update total_points in tenant_profiles
CREATE OR REPLACE FUNCTION update_tenant_total_points()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE tenant_profiles 
    SET total_points = (SELECT COALESCE(SUM(points), 0) FROM tenant_rewards WHERE profile_id = NEW.profile_id),
        updated_at = NOW()
    WHERE profile_id = NEW.profile_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tenant_total_points
AFTER INSERT ON tenant_rewards
FOR EACH ROW EXECUTE FUNCTION update_tenant_total_points();

