DROP TRIGGER IF EXISTS notify_order_confirmation_trigger ON public.orders;

CREATE TRIGGER notify_order_confirmation_trigger
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (NEW.status = 'placed' AND OLD.status IS DISTINCT FROM 'placed')
EXECUTE FUNCTION public.notify_order_confirmation();