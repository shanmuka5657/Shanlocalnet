-- ============================================================================
-- Migration 0001: Database Security Roles & PostGIS Extensions (Stage B.1 §4.10)
-- ============================================================================

-- 1. Enable required extensions (Executed by superuser / RDS rds_superuser during bootstrap)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Create Least-Privilege Database Roles (Idempotent DO block)
DO $$
BEGIN
  -- Schema & Migration Owner Role
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'localnet_migrator') THEN
    CREATE ROLE localnet_migrator NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT LOGIN;
  END IF;

  -- Production/Development Application Runtime Role (No DDL, No Superuser)
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'localnet_app') THEN
    CREATE ROLE localnet_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT LOGIN;
  END IF;

  -- Read-Only Analytics / Reporting Role
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'localnet_readonly') THEN
    CREATE ROLE localnet_readonly NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT LOGIN;
  END IF;

  -- Isolated Automated Test Runner Role
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'localnet_test') THEN
    CREATE ROLE localnet_test NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT LOGIN;
  END IF;
END
$$;

-- Revoke default public creation privileges on public schema
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO localnet_migrator;
GRANT USAGE ON SCHEMA public TO localnet_app, localnet_readonly, localnet_test;
