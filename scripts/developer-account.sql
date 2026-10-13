-- Developer Super Account — production migration (additive, idempotent).
-- 1) Adds the DEVELOPER value to the existing "Role" enum.
-- 2) Makes developer audit rows (action LIKE 'DEV_%') APPEND-ONLY at the database
--    level: any UPDATE or DELETE on such a row raises an error, so even a bug or a
--    careless script in the app cannot rewrite or erase the developer's trail.
--    All other ActivityLog rows behave exactly as before.
-- Touches no existing row or column. Run BEFORE using the Developer account:
--   npx prisma db execute --url "postgresql://…neon…?sslmode=require" --file scripts/developer-account.sql

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DEVELOPER';

CREATE OR REPLACE FUNCTION ora_protect_dev_audit() RETURNS trigger AS $fn$
BEGIN
  IF OLD."action" LIKE 'DEV\_%' ESCAPE '\' THEN
    RAISE EXCEPTION 'Developer audit records are append-only (% blocked)', TG_OP;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ora_protect_dev_audit_trg ON "ActivityLog";
CREATE TRIGGER ora_protect_dev_audit_trg
  BEFORE UPDATE OR DELETE ON "ActivityLog"
  FOR EACH ROW EXECUTE FUNCTION ora_protect_dev_audit();
