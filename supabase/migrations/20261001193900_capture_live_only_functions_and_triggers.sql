-- Version-control capture of objects that were already live in production
-- but never checked into a migration (found during the 2026-10-01 audit).
-- Every definition below was pulled directly from the live database via
-- `pg_get_functiondef` / `pg_get_triggerdef` and is reproduced verbatim —
-- nothing here is a guess or a rewrite. Every statement is
-- CREATE OR REPLACE / DROP+CREATE TRIGGER with an identical body, so
-- applying this migration against the already-live database is a no-op; its
-- purpose is to close the gap where `supabase/migrations/` no longer fully
-- describes the schema, not to change any behavior.
--
-- Do not edit the bodies below without also changing the live function —
-- they're documentation of current behavior first, a deployable migration
-- second.

CREATE OR REPLACE FUNCTION public.mark_quote_ready(_assessment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_staff_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only staff or admin can mark a quote ready';
  END IF;
  UPDATE public.assessments SET status = 'quote_ready', updated_at = now() WHERE id = _assessment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.request_more_info(_assessment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_staff_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only staff or admin can request more info';
  END IF;
  UPDATE public.assessments SET status = 'needs_more_info', updated_at = now() WHERE id = _assessment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decline_proposal(_assessment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_staff_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only staff or admin can decline a proposal';
  END IF;
  UPDATE public.assessments SET status = 'declined', updated_at = now() WHERE id = _assessment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maybe_mark_order_ready_for_return()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if NEW.qc_status = 'passed' and OLD.qc_status is distinct from 'passed' then
    if not exists (
      select 1 from public.order_pairs
      where order_id = NEW.order_id
        and (completion_status <> 'complete' or qc_status <> 'passed')
    ) then
      update public.orders
        set status = 'ready-for-return'
        where id = NEW.order_id and status <> 'ready-for-return';
    end if;
  end if;
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_qc_and_completion_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Repairs just finished -> queue this pair for QC. Clears any stale
  -- note/timestamp from a previous round so the review screen never shows
  -- an old verdict against new work.
  if NEW.completion_status = 'complete' and OLD.completion_status is distinct from 'complete' then
    NEW.qc_status := 'pending';
    NEW.qc_notes := null;
    NEW.qc_reviewed_at := null;
  end if;

  -- QC denied -> bounce back to the workshop automatically. Whoever fails a
  -- pair (a real reviewer screen today, direct SQL until it exists) only
  -- ever has to set qc_status = 'failed' + qc_notes; this does the rest.
  if NEW.qc_status = 'failed' and OLD.qc_status is distinct from 'failed' then
    NEW.completion_status := 'in-progress';
    NEW.qc_reviewed_at := now();
  end if;

  if NEW.qc_status = 'passed' and OLD.qc_status is distinct from 'passed' then
    NEW.qc_reviewed_at := now();
  end if;

  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.maybe_unmark_order_ready_for_return()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _reverted_order_id uuid;
begin
  if NEW.qc_status = 'failed' and OLD.qc_status is distinct from 'failed' then
    update public.orders
      set status = 'in-repair'
      where id = NEW.order_id and status = 'ready-for-return'
      returning id into _reverted_order_id;

    if _reverted_order_id is not null then
      perform public._invoke_edge_function(
        'send-qc-delay-notice',
        jsonb_build_object('order_id', _reverted_order_id)
      );
    end if;
  end if;
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_proposal_received()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._invoke_edge_function(
    'send-proposal-received',
    jsonb_build_object('record', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$function$;

-- Triggers — DROP + CREATE rather than a bare CREATE, since Postgres has no
-- CREATE OR REPLACE TRIGGER before version 14 and this project targets
-- broad compatibility; DROP ... IF EXISTS makes this safe to re-run.

DROP TRIGGER IF EXISTS notify_proposal_received_trigger ON public.assessments;
CREATE TRIGGER notify_proposal_received_trigger
  AFTER UPDATE ON public.assessments
  FOR EACH ROW
  WHEN (NEW.status = 'quote_ready' AND OLD.status IS DISTINCT FROM 'quote_ready')
  EXECUTE FUNCTION public.notify_proposal_received();

DROP TRIGGER IF EXISTS order_pairs_sync_qc_and_completion_status ON public.order_pairs;
CREATE TRIGGER order_pairs_sync_qc_and_completion_status
  BEFORE UPDATE ON public.order_pairs
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_qc_and_completion_status();

DROP TRIGGER IF EXISTS order_pairs_maybe_ready_for_return ON public.order_pairs;
CREATE TRIGGER order_pairs_maybe_ready_for_return
  AFTER UPDATE ON public.order_pairs
  FOR EACH ROW
  EXECUTE FUNCTION public.maybe_mark_order_ready_for_return();

DROP TRIGGER IF EXISTS order_pairs_maybe_unmark_ready_for_return ON public.order_pairs;
CREATE TRIGGER order_pairs_maybe_unmark_ready_for_return
  AFTER UPDATE ON public.order_pairs
  FOR EACH ROW
  EXECUTE FUNCTION public.maybe_unmark_order_ready_for_return();
