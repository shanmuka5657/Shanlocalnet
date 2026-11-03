-- ============================================================================
-- Rollback 0001: Revoke Schema Privileges (Non-Destructive Role Cleanup)
-- ============================================================================
REVOKE USAGE ON SCHEMA public FROM localnet_app, localnet_readonly, localnet_test;
REVOKE USAGE, CREATE ON SCHEMA public FROM localnet_migrator;
