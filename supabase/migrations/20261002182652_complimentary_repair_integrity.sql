-- Pilot release: retain legacy names; establish complete per-bag order records.
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS complimentary boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_assessment_id_unique ON public.orders(assessment_id) WHERE assessment_id IS NOT NULL;
ALTER TABLE public.order_pairs ADD COLUMN IF NOT EXISTS source_pair_id text;
ALTER TABLE public.order_pairs ADD COLUMN IF NOT EXISTS customer_photo_paths jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Existing owner UPDATE policies must not allow customers to approve or comp themselves.
CREATE OR REPLACE FUNCTION public.guard_assessment_staff_fields() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_user IN ('service_role','postgres','supabase_admin') OR public.is_staff_or_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.complimentary OR NEW.status <> 'pending' OR NEW.proposed_services <> '[]'::jsonb THEN
      RAISE EXCEPTION 'Only staff may publish recommendations or authorize complimentary work';
    END IF;
  ELSIF NEW.complimentary IS DISTINCT FROM OLD.complimentary
    OR NEW.proposed_services IS DISTINCT FROM OLD.proposed_services
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.proposal_token IS DISTINCT FROM OLD.proposal_token THEN
    RAISE EXCEPTION 'Only staff may change approval fields';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.pairs IS DISTINCT FROM OLD.pairs
    AND OLD.status NOT IN ('pending','needs_more_info') THEN
    RAISE EXCEPTION 'Published bag details require staff review';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_assessment_staff_fields ON public.assessments;
CREATE TRIGGER guard_assessment_staff_fields BEFORE INSERT OR UPDATE ON public.assessments
FOR EACH ROW EXECUTE FUNCTION public.guard_assessment_staff_fields();

-- One RPC = one database transaction. Only the authenticated backend service role
-- may call it; the HTTP handler validates ownership/token and canonical selections.
CREATE OR REPLACE FUNCTION public.confirm_complimentary_repair(
  p_assessment_id uuid, p_expected_updated_at timestamptz, p_payload jsonb,
  p_event_uri text, p_pickup_date date, p_pickup_label text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  a public.assessments%ROWTYPE;
  existing public.orders%ROWTYPE;
  repair_id uuid;
  bag_id uuid;
  bag_key text;
  bag_map jsonb := '{}'::jsonb;
  item jsonb;
  bag jsonb;
BEGIN
  SELECT * INTO a FROM public.assessments WHERE id = p_assessment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  SELECT * INTO existing FROM public.orders WHERE assessment_id = a.id;
  IF FOUND THEN
    IF existing.payment_status = 'complimentary' AND a.status = 'booked' THEN
      RETURN jsonb_build_object('order_id',existing.id,'event_uri',existing.pickup_calendly_event_uri);
    END IF;
    RAISE EXCEPTION 'An order already exists; staff review required';
  END IF;
  IF a.status <> 'quote_ready' OR NOT a.complimentary THEN RAISE EXCEPTION 'Request is not available for confirmation'; END IF;
  IF a.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Recommendations changed; please review them again'; END IF;
  IF p_event_uri IS NULL OR length(p_event_uri)=0 OR p_pickup_date IS NULL THEN RAISE EXCEPTION 'Pickup booking required'; END IF;
  IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'items')=0 THEN RAISE EXCEPTION 'Select at least one repair'; END IF;

  INSERT INTO public.orders(user_id,status,delivery_method,delivery_address,contact_email,contact_phone,
    repairs_subtotal_cents,courier_fee_cents,tax_cents,total_cents,payment_status,assessment_id,
    pickup_date,pickup_time_label,pickup_calendly_event_uri)
  VALUES(a.user_id,'pending_payment','door-to-door',p_payload->'delivery_address',p_payload->>'contact_email',
    p_payload->>'contact_phone',0,0,0,0,'complimentary',a.id,p_pickup_date,p_pickup_label,p_event_uri)
  RETURNING id INTO repair_id;
  FOR item IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
    bag := item->'pair_snapshot';
    bag_key := bag->>'id';
    IF bag_key IS NULL OR bag_key = '' THEN RAISE EXCEPTION 'Stable bag identifier required'; END IF;
    IF NOT bag_map ? bag_key THEN
      INSERT INTO public.order_pairs(order_id,source_pair_id,shoe_type,customer_notes,customer_photo_paths)
      VALUES(repair_id,bag_key,'Bag',bag->>'description',coalesce(bag->'photoPaths','[]'::jsonb)) RETURNING id INTO bag_id;
      bag_map := bag_map || jsonb_build_object(bag_key,bag_id);
    ELSE bag_id := (bag_map->>bag_key)::uuid; END IF;
    INSERT INTO public.order_items(order_id,order_pair_id,pair_snapshot,service_snapshot,price_cents)
    VALUES(repair_id,bag_id,bag,item->'service_snapshot',0);
  END LOOP;
  UPDATE public.orders SET status='placed' WHERE id=repair_id;
  UPDATE public.assessments SET status='booked',updated_at=now() WHERE id=a.id;
  RETURN jsonb_build_object('order_id',repair_id,'event_uri',p_event_uri);
END $$;
REVOKE ALL ON FUNCTION public.confirm_complimentary_repair(uuid,timestamptz,jsonb,text,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_complimentary_repair(uuid,timestamptz,jsonb,text,date,text) TO service_role;

-- Preserve old photo angles while adding the two bag-specific evidence views.
ALTER TABLE public.pair_photos DROP CONSTRAINT IF EXISTS pair_photos_angle_check;
ALTER TABLE public.pair_photos ADD CONSTRAINT pair_photos_angle_check
  CHECK (angle IN ('sole','topDown','leftSide','rightSide','back','inside','overall','detail'));
