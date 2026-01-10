-- ============================================================================
-- ADMIN DASHBOARD SOTA 2026 - Migration complète
-- Modération IA-First, Comptabilité avancée, Suivi forfaits intelligent
-- ============================================================================

-- ============================================================================
-- 1. TABLE: moderation_rules - Règles de modération IA-First
-- ============================================================================
CREATE TABLE IF NOT EXISTS moderation_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    flow_type VARCHAR(50) NOT NULL CHECK (flow_type IN ('profile', 'message', 'document', 'listing', 'payment', 'review')),

    -- Configuration IA
    ai_enabled BOOLEAN DEFAULT true,
    ai_model VARCHAR(100) DEFAULT 'gpt-4-turbo',
    ai_threshold DECIMAL(3,2) DEFAULT 0.75 CHECK (ai_threshold BETWEEN 0 AND 1),

    -- Règles JSON
    rule_config JSONB NOT NULL DEFAULT '{}',
    -- Exemple: {"keywords": ["spam", "arnaque"], "patterns": ["\\b\\d{10}\\b"], "severity": "high"}

    -- Actions automatiques
    auto_action VARCHAR(50) DEFAULT 'flag' CHECK (auto_action IN ('flag', 'quarantine', 'reject', 'escalate', 'notify')),
    escalation_delay_hours INTEGER DEFAULT 24,
    notify_admin BOOLEAN DEFAULT true,

    -- Métriques
    total_triggered INTEGER DEFAULT 0,
    total_false_positives INTEGER DEFAULT 0,
    accuracy_rate DECIMAL(5,2) DEFAULT 100.00,

    -- Statut
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 50 CHECK (priority BETWEEN 1 AND 100),

    -- Audit
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_moderation_rules_flow_type ON moderation_rules(flow_type);
CREATE INDEX IF NOT EXISTS idx_moderation_rules_active ON moderation_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_moderation_rules_priority ON moderation_rules(priority DESC);

-- ============================================================================
-- 2. TABLE: moderation_queue - File d'attente de modération IA
-- ============================================================================
CREATE TABLE IF NOT EXISTS moderation_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Entité concernée
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('profile', 'property', 'lease', 'message', 'document', 'review', 'payment')),
    entity_id UUID NOT NULL,

    -- Règle déclenchée
    rule_id UUID REFERENCES moderation_rules(id) ON DELETE SET NULL,

    -- Scoring IA
    ai_score DECIMAL(5,4) CHECK (ai_score BETWEEN 0 AND 1),
    ai_reasoning TEXT,
    ai_suggested_action VARCHAR(50),

    -- Contenu détecté
    flagged_content TEXT,
    matched_patterns JSONB DEFAULT '[]',

    -- Workflow
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected', 'escalated', 'auto_resolved')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),

    -- Modérateur
    assigned_to UUID REFERENCES auth.users(id),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- Actions prises
    action_taken VARCHAR(50),
    action_metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_moderation_queue_status ON moderation_queue(status);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_priority ON moderation_queue(priority);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_entity ON moderation_queue(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_assigned ON moderation_queue(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_moderation_queue_created ON moderation_queue(created_at DESC);

-- ============================================================================
-- 3. TABLE: admin_revenue_metrics - Métriques revenus réelles (pas simulées!)
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_revenue_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    period_date DATE NOT NULL,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),

    -- Loyers
    total_rent_expected DECIMAL(12,2) DEFAULT 0,
    total_rent_collected DECIMAL(12,2) DEFAULT 0,
    rent_collection_rate DECIMAL(5,2) DEFAULT 0,

    -- Charges
    total_charges_expected DECIMAL(12,2) DEFAULT 0,
    total_charges_collected DECIMAL(12,2) DEFAULT 0,

    -- Impayés
    total_unpaid DECIMAL(12,2) DEFAULT 0,
    unpaid_count INTEGER DEFAULT 0,
    avg_days_late DECIMAL(5,2) DEFAULT 0,

    -- Abonnements plateforme
    subscription_revenue DECIMAL(12,2) DEFAULT 0,
    subscription_count INTEGER DEFAULT 0,
    churn_rate DECIMAL(5,2) DEFAULT 0,

    -- Commissions
    commission_revenue DECIMAL(12,2) DEFAULT 0,

    -- Métriques occupation
    total_properties INTEGER DEFAULT 0,
    occupied_properties INTEGER DEFAULT 0,
    occupancy_rate DECIMAL(5,2) DEFAULT 0,

    -- Timestamps
    calculated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(period_date, period_type)
);

-- Index pour requêtes temporelles
CREATE INDEX IF NOT EXISTS idx_revenue_metrics_date ON admin_revenue_metrics(period_date DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_metrics_period ON admin_revenue_metrics(period_type, period_date DESC);

-- ============================================================================
-- 4. TABLE: subscription_usage_metrics - Suivi utilisation forfaits
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscription_usage_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    plan_id VARCHAR(50) NOT NULL,

    -- Période
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Utilisation
    properties_count INTEGER DEFAULT 0,
    properties_limit INTEGER DEFAULT 0,
    tenants_count INTEGER DEFAULT 0,
    tenants_limit INTEGER DEFAULT 0,
    documents_count INTEGER DEFAULT 0,
    documents_limit INTEGER DEFAULT 0,
    api_calls_count INTEGER DEFAULT 0,
    api_calls_limit INTEGER DEFAULT 0,
    storage_used_mb DECIMAL(10,2) DEFAULT 0,
    storage_limit_mb DECIMAL(10,2) DEFAULT 0,

    -- Alertes
    is_near_limit BOOLEAN DEFAULT false,
    limit_warnings JSONB DEFAULT '[]',

    -- Recommandations IA
    ai_upgrade_suggestion VARCHAR(50),
    ai_suggestion_reason TEXT,
    ai_potential_savings DECIMAL(10,2),

    -- Timestamps
    calculated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(owner_id, period_start, period_end)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_usage_metrics_owner ON subscription_usage_metrics(owner_id);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_period ON subscription_usage_metrics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_near_limit ON subscription_usage_metrics(is_near_limit) WHERE is_near_limit = true;

-- ============================================================================
-- 5. TABLE: admin_accounting_entries - Écritures comptables détaillées
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_accounting_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Compte
    account_code VARCHAR(20) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),

    -- Écriture
    entry_date DATE NOT NULL,
    entry_type VARCHAR(50) NOT NULL,
    reference VARCHAR(100),
    description TEXT,

    -- Montants
    debit DECIMAL(12,2) DEFAULT 0,
    credit DECIMAL(12,2) DEFAULT 0,
    balance DECIMAL(12,2) DEFAULT 0,

    -- Relations
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,

    -- Statut
    is_reconciled BOOLEAN DEFAULT false,
    reconciled_at TIMESTAMPTZ,
    reconciled_by UUID REFERENCES auth.users(id),

    -- FEC (Format Échange Comptable)
    fec_journal_code VARCHAR(10),
    fec_piece_ref VARCHAR(50),
    fec_piece_date DATE,
    fec_echeance DATE,
    fec_lettrage VARCHAR(10),
    fec_date_lettrage DATE,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour grand livre et requêtes
CREATE INDEX IF NOT EXISTS idx_accounting_entries_date ON admin_accounting_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_account ON admin_accounting_entries(account_code);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_property ON admin_accounting_entries(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounting_entries_reconciled ON admin_accounting_entries(is_reconciled) WHERE is_reconciled = false;

-- ============================================================================
-- 6. FONCTION RPC: admin_dashboard_stats_v2 - Stats dashboard avec vraies données
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_dashboard_stats_v2()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    current_month_start DATE := date_trunc('month', CURRENT_DATE);
    previous_month_start DATE := date_trunc('month', CURRENT_DATE - INTERVAL '1 month');
BEGIN
    SELECT json_build_object(
        -- Utilisateurs
        'totalUsers', (SELECT COUNT(*) FROM profiles),
        'usersByRole', (
            SELECT json_build_object(
                'admin', COUNT(*) FILTER (WHERE role = 'admin'),
                'owner', COUNT(*) FILTER (WHERE role = 'owner'),
                'tenant', COUNT(*) FILTER (WHERE role = 'tenant'),
                'provider', COUNT(*) FILTER (WHERE role = 'provider')
            ) FROM profiles
        ),
        'newUsersThisMonth', (SELECT COUNT(*) FROM profiles WHERE created_at >= current_month_start),
        'newUsersPrevMonth', (SELECT COUNT(*) FROM profiles WHERE created_at >= previous_month_start AND created_at < current_month_start),

        -- Propriétés
        'totalProperties', (SELECT COUNT(*) FROM properties WHERE deleted_at IS NULL),
        'propertiesByStatus', (
            SELECT json_build_object(
                'active', COUNT(*) FILTER (WHERE status = 'active'),
                'rented', COUNT(*) FILTER (WHERE status = 'rented'),
                'draft', COUNT(*) FILTER (WHERE status = 'draft'),
                'archived', COUNT(*) FILTER (WHERE status = 'archived')
            ) FROM properties WHERE deleted_at IS NULL
        ),

        -- Baux
        'totalLeases', (SELECT COUNT(*) FROM leases),
        'activeLeases', (SELECT COUNT(*) FROM leases WHERE status = 'active'),
        'leasesByStatus', (
            SELECT json_build_object(
                'active', COUNT(*) FILTER (WHERE status = 'active'),
                'pending_signature', COUNT(*) FILTER (WHERE status = 'pending_signature'),
                'draft', COUNT(*) FILTER (WHERE status = 'draft'),
                'terminated', COUNT(*) FILTER (WHERE status IN ('terminated', 'expired'))
            ) FROM leases
        ),

        -- Factures
        'totalInvoices', (SELECT COUNT(*) FROM invoices),
        'unpaidInvoices', (SELECT COUNT(*) FROM invoices WHERE status IN ('sent', 'late', 'unpaid')),
        'invoicesByStatus', (
            SELECT json_build_object(
                'paid', COUNT(*) FILTER (WHERE status = 'paid'),
                'sent', COUNT(*) FILTER (WHERE status = 'sent'),
                'late', COUNT(*) FILTER (WHERE status = 'late'),
                'draft', COUNT(*) FILTER (WHERE status = 'draft')
            ) FROM invoices
        ),

        -- Tickets
        'totalTickets', (SELECT COUNT(*) FROM tickets),
        'openTickets', (SELECT COUNT(*) FROM tickets WHERE status IN ('open', 'in_progress')),
        'ticketsByStatus', (
            SELECT json_build_object(
                'open', COUNT(*) FILTER (WHERE status = 'open'),
                'in_progress', COUNT(*) FILTER (WHERE status = 'in_progress'),
                'resolved', COUNT(*) FILTER (WHERE status = 'resolved'),
                'closed', COUNT(*) FILTER (WHERE status = 'closed')
            ) FROM tickets
        ),

        -- Revenus mensuels (12 derniers mois - VRAIES DONNÉES)
        'monthlyRevenue', (
            SELECT COALESCE(json_agg(row_to_json(m) ORDER BY m.month_date), '[]'::json)
            FROM (
                SELECT
                    to_char(date_trunc('month', due_date), 'Mon') as month,
                    date_trunc('month', due_date) as month_date,
                    SUM(amount) as attendu,
                    SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as encaisse
                FROM invoices
                WHERE due_date >= CURRENT_DATE - INTERVAL '12 months'
                GROUP BY date_trunc('month', due_date)
                ORDER BY date_trunc('month', due_date)
            ) m
        ),

        -- Tendances (évolution sur 7 derniers jours)
        'trends', json_build_object(
            'users', (
                SELECT json_agg(COALESCE(c, 0) ORDER BY d)
                FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day') d
                LEFT JOIN (
                    SELECT DATE(created_at) as date, COUNT(*) as c
                    FROM profiles
                    WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
                    GROUP BY DATE(created_at)
                ) p ON p.date = d
            ),
            'properties', (
                SELECT json_agg(COALESCE(c, 0) ORDER BY d)
                FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day') d
                LEFT JOIN (
                    SELECT DATE(created_at) as date, COUNT(*) as c
                    FROM properties
                    WHERE created_at >= CURRENT_DATE - INTERVAL '6 days' AND deleted_at IS NULL
                    GROUP BY DATE(created_at)
                ) p ON p.date = d
            ),
            'leases', (
                SELECT json_agg(COALESCE(c, 0) ORDER BY d)
                FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day') d
                LEFT JOIN (
                    SELECT DATE(created_at) as date, COUNT(*) as c
                    FROM leases
                    WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
                    GROUP BY DATE(created_at)
                ) p ON p.date = d
            )
        ),

        -- Taux de performance
        'occupancyRate', (
            SELECT ROUND(
                (COUNT(*) FILTER (WHERE status = 'rented')::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 1
            )
            FROM properties WHERE deleted_at IS NULL AND status IN ('active', 'rented')
        ),
        'collectionRate', (
            SELECT ROUND(
                (COUNT(*) FILTER (WHERE status = 'paid')::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 1
            )
            FROM invoices
            WHERE due_date >= CURRENT_DATE - INTERVAL '3 months'
        ),

        -- Documents et contenu
        'totalDocuments', (SELECT COUNT(*) FROM documents),
        'totalBlogPosts', (SELECT COUNT(*) FROM blog_posts),
        'publishedBlogPosts', (SELECT COUNT(*) FROM blog_posts WHERE is_published = true),

        -- Modération
        'moderationPending', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'pending'),
        'moderationCritical', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'pending' AND priority = 'critical'),

        -- Abonnements
        'subscriptionStats', (
            SELECT json_build_object(
                'total', COUNT(*),
                'active', COUNT(*) FILTER (WHERE status = 'active'),
                'trial', COUNT(*) FILTER (WHERE status = 'trialing'),
                'churned', COUNT(*) FILTER (WHERE status = 'canceled')
            ) FROM subscriptions
        ),

        -- Activité récente (vraies données)
        'recentActivity', (
            SELECT COALESCE(json_agg(activity ORDER BY activity.date DESC), '[]'::json)
            FROM (
                SELECT 'user' as type,
                       CONCAT('Nouvel utilisateur: ', prenom, ' ', nom) as description,
                       created_at as date
                FROM profiles
                ORDER BY created_at DESC
                LIMIT 3

                UNION ALL

                SELECT 'property' as type,
                       CONCAT('Nouveau bien: ', COALESCE(adresse_complete, 'Adresse non définie')) as description,
                       created_at as date
                FROM properties
                WHERE deleted_at IS NULL
                ORDER BY created_at DESC
                LIMIT 3

                UNION ALL

                SELECT 'lease' as type,
                       'Nouveau bail créé' as description,
                       created_at as date
                FROM leases
                ORDER BY created_at DESC
                LIMIT 2

                LIMIT 8
            ) activity
        )

    ) INTO result;

    RETURN result;
END;
$$;

-- ============================================================================
-- 7. FONCTION RPC: get_moderation_stats - Stats de modération
-- ============================================================================
CREATE OR REPLACE FUNCTION get_moderation_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN json_build_object(
        'pending', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'pending'),
        'reviewing', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'reviewing'),
        'approved', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'approved' AND created_at >= CURRENT_DATE - INTERVAL '30 days'),
        'rejected', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'rejected' AND created_at >= CURRENT_DATE - INTERVAL '30 days'),
        'escalated', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'escalated'),
        'byPriority', json_build_object(
            'critical', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'pending' AND priority = 'critical'),
            'high', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'pending' AND priority = 'high'),
            'medium', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'pending' AND priority = 'medium'),
            'low', (SELECT COUNT(*) FROM moderation_queue WHERE status = 'pending' AND priority = 'low')
        ),
        'byType', (
            SELECT json_object_agg(entity_type, cnt)
            FROM (
                SELECT entity_type, COUNT(*) as cnt
                FROM moderation_queue
                WHERE status = 'pending'
                GROUP BY entity_type
            ) t
        ),
        'rulesActive', (SELECT COUNT(*) FROM moderation_rules WHERE is_active = true),
        'avgResolutionHours', (
            SELECT ROUND(AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 3600), 1)
            FROM moderation_queue
            WHERE reviewed_at IS NOT NULL AND created_at >= CURRENT_DATE - INTERVAL '30 days'
        )
    );
END;
$$;

-- ============================================================================
-- 8. FONCTION RPC: get_accounting_summary - Résumé comptable
-- ============================================================================
CREATE OR REPLACE FUNCTION get_accounting_summary(
    p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '1 year'),
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN json_build_object(
        'period', json_build_object('start', p_start_date, 'end', p_end_date),

        -- Totaux
        'totals', (
            SELECT json_build_object(
                'revenue', COALESCE(SUM(CASE WHEN account_type = 'revenue' THEN credit - debit END), 0),
                'expenses', COALESCE(SUM(CASE WHEN account_type = 'expense' THEN debit - credit END), 0),
                'assets', COALESCE(SUM(CASE WHEN account_type = 'asset' THEN balance END), 0),
                'liabilities', COALESCE(SUM(CASE WHEN account_type = 'liability' THEN balance END), 0)
            )
            FROM admin_accounting_entries
            WHERE entry_date BETWEEN p_start_date AND p_end_date
        ),

        -- Par mois
        'byMonth', (
            SELECT COALESCE(json_agg(row_to_json(m) ORDER BY m.month), '[]'::json)
            FROM (
                SELECT
                    to_char(entry_date, 'YYYY-MM') as month,
                    SUM(CASE WHEN account_type = 'revenue' THEN credit - debit ELSE 0 END) as revenue,
                    SUM(CASE WHEN account_type = 'expense' THEN debit - credit ELSE 0 END) as expenses
                FROM admin_accounting_entries
                WHERE entry_date BETWEEN p_start_date AND p_end_date
                GROUP BY to_char(entry_date, 'YYYY-MM')
            ) m
        ),

        -- Non rapprochées
        'unreconciled', (
            SELECT json_build_object(
                'count', COUNT(*),
                'totalDebit', COALESCE(SUM(debit), 0),
                'totalCredit', COALESCE(SUM(credit), 0)
            )
            FROM admin_accounting_entries
            WHERE is_reconciled = false
        ),

        -- Top 10 comptes par volume
        'topAccounts', (
            SELECT COALESCE(json_agg(row_to_json(a)), '[]'::json)
            FROM (
                SELECT
                    account_code,
                    account_name,
                    SUM(debit) as total_debit,
                    SUM(credit) as total_credit,
                    COUNT(*) as entries_count
                FROM admin_accounting_entries
                WHERE entry_date BETWEEN p_start_date AND p_end_date
                GROUP BY account_code, account_name
                ORDER BY SUM(debit) + SUM(credit) DESC
                LIMIT 10
            ) a
        )
    );
END;
$$;

-- ============================================================================
-- 9. TRIGGER: Mise à jour automatique updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer aux nouvelles tables
DROP TRIGGER IF EXISTS set_updated_at_moderation_rules ON moderation_rules;
CREATE TRIGGER set_updated_at_moderation_rules
    BEFORE UPDATE ON moderation_rules
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_moderation_queue ON moderation_queue;
CREATE TRIGGER set_updated_at_moderation_queue
    BEFORE UPDATE ON moderation_queue
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================================
-- 10. RLS Policies
-- ============================================================================

-- Moderation Rules - Admin only
ALTER TABLE moderation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage moderation rules" ON moderation_rules;
CREATE POLICY "Admin can manage moderation rules" ON moderation_rules
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Moderation Queue - Admin only
ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage moderation queue" ON moderation_queue;
CREATE POLICY "Admin can manage moderation queue" ON moderation_queue
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Revenue Metrics - Admin only
ALTER TABLE admin_revenue_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view revenue metrics" ON admin_revenue_metrics;
CREATE POLICY "Admin can view revenue metrics" ON admin_revenue_metrics
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Accounting Entries - Admin only
ALTER TABLE admin_accounting_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage accounting entries" ON admin_accounting_entries;
CREATE POLICY "Admin can manage accounting entries" ON admin_accounting_entries
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Subscription Usage - Admin and Owner
ALTER TABLE subscription_usage_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view all usage metrics" ON subscription_usage_metrics;
CREATE POLICY "Admin can view all usage metrics" ON subscription_usage_metrics
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Owner can view own usage metrics" ON subscription_usage_metrics;
CREATE POLICY "Owner can view own usage metrics" ON subscription_usage_metrics
    FOR SELECT
    USING (
        owner_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- 11. Données initiales pour les règles de modération
-- ============================================================================
INSERT INTO moderation_rules (name, description, flow_type, ai_enabled, ai_threshold, rule_config, auto_action, priority)
VALUES
    (
        'Détection spam profils',
        'Détecte les profils suspects avec liens ou contenu spam',
        'profile',
        true,
        0.80,
        '{"keywords": ["http://", "https://", "gagnez", "gratuit", "cliquez"], "maxLinks": 2, "minNameLength": 2}',
        'quarantine',
        90
    ),
    (
        'Vérification documents',
        'Analyse automatique des documents d''identité',
        'document',
        true,
        0.85,
        '{"requiredFields": ["nom", "prenom", "date_naissance"], "checkExpiry": true, "ocrEnabled": true}',
        'flag',
        85
    ),
    (
        'Modération annonces',
        'Vérifie la conformité des annonces immobilières',
        'listing',
        true,
        0.75,
        '{"bannedWords": ["arnaque", "urgent cash"], "requirePhotos": true, "minDescription": 50}',
        'flag',
        80
    ),
    (
        'Détection fraude paiement',
        'Surveille les patterns de paiement suspects',
        'payment',
        true,
        0.90,
        '{"maxAmountAlert": 50000, "frequencyCheck": true, "geoCheck": true}',
        'escalate',
        95
    )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- GRANT permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON moderation_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON moderation_queue TO authenticated;
GRANT SELECT ON admin_revenue_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_accounting_entries TO authenticated;
GRANT SELECT ON subscription_usage_metrics TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMENT ON TABLE moderation_rules IS 'Règles de modération IA-First pour le dashboard admin SOTA 2026';
COMMENT ON TABLE moderation_queue IS 'File d''attente de modération avec scoring IA';
COMMENT ON TABLE admin_revenue_metrics IS 'Métriques revenus calculées (vraies données, pas simulées)';
COMMENT ON TABLE subscription_usage_metrics IS 'Suivi utilisation des forfaits par propriétaire';
COMMENT ON TABLE admin_accounting_entries IS 'Écritures comptables détaillées format FEC';
