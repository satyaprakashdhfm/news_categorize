-- Fix orphan research cards created before attach_run bug was fixed.
-- Run once on any environment that may have these orphans.

-- 1. Transfer defense research run_id to TEC·DEF domain card, delete orphan
DO $$
DECLARE
  v_run_id TEXT;
  v_orphan_id TEXT := '518868d1-227e-4ff5-86b4-699d42d9a242';
  v_domain_id TEXT := '22d25693-35e4-480e-8983-8cdbba7e0837';
BEGIN
  SELECT run_id INTO v_run_id FROM feed_cards WHERE id = v_orphan_id;
  IF v_run_id IS NOT NULL THEN
    UPDATE feed_cards SET run_id = v_run_id WHERE id = v_domain_id;
    DELETE FROM feed_cards WHERE id = v_orphan_id;
    RAISE NOTICE 'Transferred defense run_id % to TEC·DEF domain card', v_run_id;
  ELSE
    RAISE NOTICE 'Defense orphan not found or already deleted, skipping.';
  END IF;
END $$;

-- 2. Tag US AI startup card as TEC·SAI so it shows a DNA badge
UPDATE feed_cards
SET domain = 'TEC', subdomain = 'SAI'
WHERE id = 'ce954518-6291-4822-a67e-2b18f406f95c'
  AND domain IS NULL;
