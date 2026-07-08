-- Strip "per ..." unit text from card_price_label so grid cards show only
-- the flat dollar amount (e.g. "$45" not "$45 per buckle or piece of hardware").
-- The service detail page appends "per pair" on the frontend.
--
-- Regex: \s+per\s+\S.*   →  one or more spaces, "per", a space, then anything
-- using case-insensitive matching so "Per Pair", "per shoe", etc. all match.

UPDATE public.services
SET card_price_label = TRIM(regexp_replace(card_price_label, '\s+per\s+\S.*', '', 'gi'))
WHERE card_price_label ~* '\sper\s';
