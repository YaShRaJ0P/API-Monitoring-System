-- Database Schema for API Monitoring System
-- Run this script to initialize the PostgreSQL database schema.

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    google_id VARCHAR(255) UNIQUE,
    name VARCHAR(255),
    avatar TEXT,
    env_id UUID UNIQUE DEFAULT gen_random_uuid(), -- Used as API Key for ingestion
    refresh_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Minute Metrics (for detailed granular data per endpoint)
-- Equivalent to 'endpoint_metrics', storing 1-minute aggregations for every endpoint
CREATE TABLE IF NOT EXISTS minute_metrics (
    tenant_id UUID NOT NULL,
    service VARCHAR(255) NOT NULL,
    environment VARCHAR(255) NOT NULL,
    endpoint VARCHAR(255) NOT NULL, -- normalise by /api/:id
    method VARCHAR(10) NOT NULL DEFAULT 'GET',
    minute_bucket TIMESTAMP WITH TIME ZONE NOT NULL,
    
    total_requests INT DEFAULT 0,
    success_count INT DEFAULT 0,
    failure_count INT DEFAULT 0,
    total_latency BIGINT DEFAULT 0,
    min_latency INT DEFAULT 2147483647, -- Added for min latency tracking
    max_latency INT DEFAULT 0, -- Added for max latency tracking
    
    PRIMARY KEY (tenant_id, service, environment, endpoint, method, minute_bucket)
);

CREATE INDEX IF NOT EXISTS idx_minute_metrics_cleanup ON minute_metrics(minute_bucket);
CREATE INDEX IF NOT EXISTS idx_metrics_service_env ON minute_metrics(service, environment);
CREATE INDEX IF NOT EXISTS idx_metrics_endpoint ON minute_metrics(endpoint, method);

-- 3. Hourly Metrics (aggregated for longer retention)
CREATE TABLE IF NOT EXISTS hourly_metrics (
    tenant_id UUID NOT NULL,
    service VARCHAR(255) NOT NULL,
    environment VARCHAR(255) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL DEFAULT 'GET',
    hour_bucket TIMESTAMP WITH TIME ZONE NOT NULL,
    
    total_requests INT DEFAULT 0,
    success_count INT DEFAULT 0,
    failure_count INT DEFAULT 0,
    total_latency BIGINT DEFAULT 0,
    min_latency INT DEFAULT 0,
    max_latency INT DEFAULT 0,
    
    PRIMARY KEY (tenant_id, service, environment, endpoint, method, hour_bucket)
);

-- 4. Alert Rules
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    metric VARCHAR(50) NOT NULL,       -- 'error_rate', 'latency', 'request_count'
    condition VARCHAR(10) NOT NULL,    -- '>', '<'
    threshold FLOAT NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning', -- 'info', 'warning', 'critical'
    window_minutes INT NOT NULL DEFAULT 5,
    cooldown_minutes INT NOT NULL DEFAULT 60,
    silence_until TIMESTAMP WITH TIME ZONE,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant ON alert_rules(tenant_id);

-- 5. Alert History (Triggered Alerts)
CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    metric_value FLOAT NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning', -- Stores severity at the time of trigger
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alert_history_tenant ON alert_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history(rule_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON alert_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
