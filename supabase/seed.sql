-- A fresh database gets its catalog from the migrations:
--   service areas (Manhattan zips)
--   pricing_config (courier fee and free-delivery threshold)
--   repair_packages
--   services
-- Those inserts use ON CONFLICT DO NOTHING, so running them again is safe.
--
-- This file intentionally adds no customer accounts, orders, photos, notes,
-- or agreements. Do not copy production rows into here.

SELECT 1;
