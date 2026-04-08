-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    google_id VARCHAR(255) UNIQUE,
    name VARCHAR(255),
    avatar TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    refresh_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key UUID UNIQUE DEFAULT gen_random_uuid(),
    api_secret VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- A tenant cannot have two projects with the same name
    UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_api_key ON projects(api_key);

-- 3. Minute Metrics (1-minute aggregations per endpoint per project)
CREATE TABLE IF NOT EXISTS minute_metrics (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    service VARCHAR(255) NOT NULL,
    environment VARCHAR(50) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL DEFAULT 'GET',
    minute_bucket TIMESTAMP WITH TIME ZONE NOT NULL,

    total_requests INT DEFAULT 0 CHECK (total_requests >= 0),
    success_count INT DEFAULT 0 CHECK (success_count >= 0),
    failure_count INT DEFAULT 0 CHECK (failure_count >= 0),
    total_latency BIGINT DEFAULT 0 CHECK (total_latency >= 0),
    min_latency BIGINT DEFAULT 2147483647 CHECK (min_latency >= 0),
    max_latency BIGINT DEFAULT 0 CHECK (max_latency >= 0),

    PRIMARY KEY (project_id, service, environment, endpoint, method, minute_bucket),
    CHECK (environment IN ('production', 'staging', 'development'))
);

CREATE INDEX IF NOT EXISTS idx_minute_metrics_cleanup ON minute_metrics(minute_bucket);
CREATE INDEX IF NOT EXISTS idx_metrics_service_env ON minute_metrics(project_id, service, environment);
CREATE INDEX IF NOT EXISTS idx_metrics_endpoint ON minute_metrics(project_id, endpoint, method);

-- 4. Hourly Metrics (aggregated for longer retention)
CREATE TABLE IF NOT EXISTS hourly_metrics (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    service VARCHAR(255) NOT NULL,
    environment VARCHAR(50) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL DEFAULT 'GET',
    hour_bucket TIMESTAMP WITH TIME ZONE NOT NULL,

    total_requests INT DEFAULT 0 CHECK (total_requests >= 0),
    success_count INT DEFAULT 0 CHECK (success_count >= 0),
    failure_count INT DEFAULT 0 CHECK (failure_count >= 0),
    total_latency BIGINT DEFAULT 0 CHECK (total_latency >= 0),
    min_latency BIGINT DEFAULT 2147483647 CHECK (min_latency >= 0),
    max_latency BIGINT DEFAULT 0 CHECK (max_latency >= 0),

    PRIMARY KEY (project_id, service, environment, endpoint, method, hour_bucket),
    CHECK (environment IN ('production', 'staging', 'development'))
);

CREATE INDEX IF NOT EXISTS idx_hourly_metrics_cleanup ON hourly_metrics(hour_bucket);
CREATE INDEX IF NOT EXISTS idx_hourly_service_env ON hourly_metrics(project_id, service, environment);

-- 5. Alert Rules
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    metric VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'resolved',
    condition VARCHAR(10) NOT NULL,
    threshold FLOAT NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning',
    window_minutes INT NOT NULL DEFAULT 5,
    cooldown_minutes INT NOT NULL DEFAULT 60,
    send_email BOOLEAN DEFAULT FALSE,
    silence_until TIMESTAMP WITH TIME ZONE,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(project_id, name),
    CHECK (severity IN ('info','warning','critical')),
    CHECK (condition IN ('>', '<')),
    CHECK (status IN ('triggered','resolved'))
);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled_project ON alert_rules(project_id, enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant ON alert_rules(tenant_id);

-- 6. Alert History
CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- snapshot fields
    rule_name VARCHAR(255),
    metric VARCHAR(50),
    condition VARCHAR(5),
    threshold DOUBLE PRECISION,
    severity VARCHAR(20) DEFAULT 'warning',
    window_minutes INT NOT NULL DEFAULT 5,
    cooldown_minutes INT NOT NULL DEFAULT 60,
    send_email BOOLEAN DEFAULT FALSE,
    silence_until TIMESTAMP WITH TIME ZONE,

    metric_value FLOAT NOT NULL,
    status VARCHAR(20) DEFAULT 'triggered',
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,

    CHECK (severity IN ('info','warning','critical')),
    CHECK (status IN ('triggered','resolved'))
);

CREATE INDEX IF NOT EXISTS idx_alert_history_latest ON alert_history(rule_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_project ON alert_history(project_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_tenant ON alert_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history(rule_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alert_rules_updated_at ON alert_rules;
CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON alert_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Outbox Entries (For projecting events to MongoDB)
CREATE TABLE IF NOT EXISTS outbox_entries (
    event_id UUID PRIMARY KEY,
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    attempts INT DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_created ON outbox_entries(status, created_at);