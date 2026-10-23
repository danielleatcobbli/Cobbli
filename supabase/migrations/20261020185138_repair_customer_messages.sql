-- All access is through authenticated backend endpoints. Customer tokens are
-- checked against the owning assessment before any privileged operation.
CREATE TABLE public.repair_questions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 assessment_id uuid NOT NULL REFERENCES public.assessments(id),
 body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.repair_responses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 question_id uuid NOT NULL UNIQUE REFERENCES public.repair_questions(id),
 submission_id uuid NOT NULL,
 body text NOT NULL DEFAULT '',
 photo_paths jsonb NOT NULL DEFAULT '[]',
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(length(body)<=4000)
);
ALTER TABLE public.repair_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_responses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.repair_questions, public.repair_responses FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.repair_questions, public.repair_responses TO service_role;
CREATE INDEX repair_questions_request ON public.repair_questions(assessment_id,created_at DESC);
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('repair-responses','repair-responses',false,10485760,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO NOTHING;

CREATE FUNCTION public.repair_request_message(request_id uuid, action text, message text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE current_status text; question uuid;
BEGIN
 SELECT status INTO current_status FROM public.assessments WHERE id=request_id FOR UPDATE;
 IF NOT FOUND OR current_status IN ('booked','closed','declined','service_unavailable') THEN
   RAISE EXCEPTION 'Request is no longer open';
 END IF;
 IF length(trim(message)) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'A message is required'; END IF;
 IF action='question' THEN
   -- Repeated asks must wait for a response, avoiding duplicate messages on retry.
   IF current_status='needs_more_info' THEN RAISE EXCEPTION 'A question is already pending'; END IF;
   INSERT INTO public.repair_questions(assessment_id,body) VALUES(request_id,trim(message)) RETURNING id INTO question;
   INSERT INTO public.repair_email_context(entity_type,entity_id,data)
   VALUES('assessment',request_id,jsonb_build_object('staff_question',trim(message),'response_flow_ready',true))
   ON CONFLICT(entity_type,entity_id) DO UPDATE SET data=EXCLUDED.data;
   UPDATE public.assessments SET status='needs_more_info' WHERE id=request_id;
 ELSIF action='decline' THEN
   INSERT INTO public.repair_email_context(entity_type,entity_id,data)
   VALUES('assessment',request_id,jsonb_build_object('staff_explanation',trim(message)))
   ON CONFLICT(entity_type,entity_id) DO UPDATE SET data=EXCLUDED.data;
   UPDATE public.assessments SET status='declined' WHERE id=request_id;
 ELSE RAISE EXCEPTION 'Invalid action'; END IF;
 RETURN question;
END;
$$;
REVOKE ALL ON FUNCTION public.repair_request_message(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.repair_request_message(uuid,text,text) TO service_role;

CREATE FUNCTION public.save_repair_response(request_id uuid, question uuid, submission uuid, message text, photos jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result uuid; current_status text;
BEGIN
 SELECT status INTO current_status FROM public.assessments WHERE id=request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.repair_questions WHERE id=question AND assessment_id=request_id) THEN
   RAISE EXCEPTION 'Question not found'; END IF;
 SELECT id INTO result FROM public.repair_responses WHERE question_id=question;
 IF result IS NOT NULL THEN RETURN result; END IF;
 IF current_status<>'needs_more_info' OR question IS DISTINCT FROM
 (SELECT id FROM public.repair_questions WHERE assessment_id=request_id ORDER BY created_at DESC,id DESC LIMIT 1)
 THEN RAISE EXCEPTION 'Question is no longer open'; END IF;
 IF length(message)>4000 OR (length(trim(message))=0 AND jsonb_array_length(photos)=0) OR jsonb_array_length(photos)>6 THEN
   RAISE EXCEPTION 'Invalid response'; END IF;
 INSERT INTO public.repair_responses(question_id,submission_id,body,photo_paths)
 VALUES(question,submission,message,photos) RETURNING id INTO result;
 UPDATE public.assessments SET status='pending' WHERE id=request_id;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.save_repair_response(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_repair_response(uuid,uuid,uuid,text,jsonb) TO service_role;

CREATE FUNCTION public.close_repair_request(request_id uuid, payment_note text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.assessments WHERE id=request_id AND status NOT IN ('booked','closed','declined','service_unavailable') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request is no longer open'; END IF;
 INSERT INTO public.repair_email_context(entity_type,entity_id,data)
 VALUES('assessment',request_id,jsonb_build_object('payment_status',payment_note))
 ON CONFLICT(entity_type,entity_id) DO UPDATE SET data=EXCLUDED.data;
 UPDATE public.assessments SET status='closed' WHERE id=request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.close_repair_request(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.close_repair_request(uuid,text) TO service_role;

CREATE FUNCTION public.cancel_repair_notification(order_id uuid, next_steps text, payment_note text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.orders WHERE id=order_id AND status NOT IN ('canceled','cancelled','completed','returned') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Repair cannot be canceled'; END IF;
 IF length(trim(next_steps)) NOT BETWEEN 1 AND 4000 OR length(trim(payment_note)) NOT BETWEEN 1 AND 4000 THEN
 RAISE EXCEPTION 'Cancellation details required'; END IF;
 INSERT INTO public.repair_email_context(entity_type,entity_id,data)
 VALUES('order',order_id,jsonb_build_object('next_steps',next_steps,'payment_status',payment_note))
 ON CONFLICT(entity_type,entity_id) DO UPDATE SET data=EXCLUDED.data;
 UPDATE public.orders SET status='canceled' WHERE id=order_id;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_repair_notification(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_repair_notification(uuid,text,text) TO service_role;
