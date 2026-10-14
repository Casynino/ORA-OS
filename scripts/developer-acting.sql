-- Work-as: extend the append-only protection to every audit row recorded while a
-- Developer works as a team member. Those rows keep the person's normal action
-- name (so existing reports still read them) but are flagged meta.developer=true,
-- and the trigger now protects any row that is EITHER a DEV_* action OR flagged.
-- Additive and idempotent. Apply to production Neon BEFORE relying on work-as:
--   npx prisma db execute --url "postgresql://…neon…?sslmode=require" --file scripts/developer-acting.sql

CREATE OR REPLACE FUNCTION ora_protect_dev_audit() RETURNS trigger AS $fn$
BEGIN
  IF OLD."action" LIKE 'DEV\_%' ESCAPE '\' OR (OLD."meta" ->> 'developer') = 'true' THEN
    RAISE EXCEPTION 'Developer audit records are append-only (% blocked)', TG_OP;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
