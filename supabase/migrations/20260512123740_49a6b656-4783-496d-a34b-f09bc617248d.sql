
-- =========================================
-- Helpers
-- =========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================
-- Roles (admin support, recursion-safe)
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- Profiles
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup (reads metadata supplied at signUp())
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'phone'
  );
  INSERT INTO public.user_security (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- =========================================
-- User security (lockout tracking)
-- =========================================
CREATE TABLE public.user_security (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_at TIMESTAMPTZ,
  last_failed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_security ENABLE ROW LEVEL SECURITY;

-- Only the user can see their own lockout state; writes happen via SECURITY DEFINER RPCs
CREATE POLICY "Users view own security" ON public.user_security FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER user_security_updated_at BEFORE UPDATE ON public.user_security
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPC: record a failed attempt for an email (callable by anon; rate limit logic handled in app)
CREATE OR REPLACE FUNCTION public.record_failed_signin(_email TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID;
  _attempts INT;
  _locked TIMESTAMPTZ;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = _email LIMIT 1;
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('locked', false, 'attempts', 0);
  END IF;

  INSERT INTO public.user_security (user_id, failed_attempts, last_failed_at)
  VALUES (_uid, 1, now())
  ON CONFLICT (user_id) DO UPDATE
    SET failed_attempts = public.user_security.failed_attempts + 1,
        last_failed_at = now()
  RETURNING failed_attempts, locked_at INTO _attempts, _locked;

  IF _attempts >= 5 AND _locked IS NULL THEN
    UPDATE public.user_security SET locked_at = now() WHERE user_id = _uid
      RETURNING locked_at INTO _locked;
  END IF;

  RETURN jsonb_build_object('locked', _locked IS NOT NULL, 'attempts', _attempts);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_account_locked(_email TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _locked TIMESTAMPTZ;
BEGIN
  SELECT us.locked_at INTO _locked
  FROM public.user_security us
  JOIN auth.users u ON u.id = us.user_id
  WHERE u.email = _email;
  RETURN _locked IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_failed_attempts(_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.user_security
    SET failed_attempts = 0, locked_at = NULL
    WHERE user_id = _user_id;
END;
$$;

-- =========================================
-- Addresses
-- =========================================
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  street TEXT NOT NULL,
  street2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own addresses" ON public.addresses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own addresses" ON public.addresses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own addresses" ON public.addresses FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own addresses" ON public.addresses FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER addresses_updated_at BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_single_default_address()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.addresses SET is_default = false
      WHERE user_id = NEW.user_id AND id <> NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER addresses_single_default
  AFTER INSERT OR UPDATE OF is_default ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_default_address();

-- =========================================
-- Payment methods (token-only — Stripe id stored, not raw card)
-- =========================================
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT NOT NULL,
  card_brand TEXT NOT NULL,
  card_last4 TEXT NOT NULL,
  exp_month INT NOT NULL,
  exp_year INT NOT NULL,
  billing_address_id UUID REFERENCES public.addresses(id) ON DELETE SET NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pm" ON public.payment_methods FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own pm" ON public.payment_methods FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pm" ON public.payment_methods FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own pm" ON public.payment_methods FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER payment_methods_updated_at BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_single_default_pm()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.payment_methods SET is_default = false
      WHERE user_id = NEW.user_id AND id <> NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payment_methods_single_default
  AFTER INSERT OR UPDATE OF is_default ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_default_pm();

-- =========================================
-- Shoe pairs
-- =========================================
CREATE TABLE public.pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shoe_type TEXT NOT NULL,
  colors TEXT[] NOT NULL DEFAULT '{}',
  brand TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pairs" ON public.pairs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own pairs" ON public.pairs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pairs" ON public.pairs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own pairs" ON public.pairs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================================
-- Services + per-shoe-type pricing (admin-managed; publicly readable)
-- =========================================
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_description TEXT,
  full_description TEXT,
  image_url TEXT,
  base_price_cents INT,
  turnaround_days INT,
  eligible_shoe_types TEXT[] NOT NULL DEFAULT '{}',
  categories TEXT[] NOT NULL DEFAULT '{}',
  popularity_rank INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads active services" ON public.services FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Admins manage services" ON public.services FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER services_updated_at BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.service_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  shoe_type TEXT NOT NULL,
  price_cents INT NOT NULL,
  UNIQUE (service_id, shoe_type)
);
ALTER TABLE public.service_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads pricing" ON public.service_pricing FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage pricing" ON public.service_pricing FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- Bag items (persistent shopping bag, price-locked at add)
-- =========================================
CREATE TABLE public.bag_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair_id UUID NOT NULL REFERENCES public.pairs(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  service_name_at_add TEXT NOT NULL,
  price_at_add_cents INT NOT NULL,
  shoe_type_at_add TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bag_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own bag" ON public.bag_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own bag" ON public.bag_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own bag" ON public.bag_items FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own bag" ON public.bag_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================================
-- Orders + items
-- =========================================
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _n TEXT;
BEGIN
  _n := 'CB-' || lpad((floor(random() * 1000000))::int::text, 6, '0');
  RETURN _n;
END;
$$;

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL UNIQUE DEFAULT public.generate_order_number(),
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'placed',
  delivery_method TEXT NOT NULL,
  -- snapshot fields so historical orders never change
  delivery_address JSONB,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  payment_method_snapshot JSONB,
  repairs_subtotal_cents INT NOT NULL,
  courier_fee_cents INT NOT NULL DEFAULT 0,
  tax_cents INT NOT NULL DEFAULT 0,
  total_cents INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  pair_snapshot JSONB NOT NULL,
  service_snapshot JSONB NOT NULL,
  price_cents INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own order items" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
);
CREATE POLICY "Users insert own order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
);
CREATE POLICY "Admins view all order items" ON public.order_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Realtime for orders so My Orders updates live
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Indexes
CREATE INDEX idx_addresses_user ON public.addresses(user_id);
CREATE INDEX idx_pm_user ON public.payment_methods(user_id);
CREATE INDEX idx_pairs_user ON public.pairs(user_id);
CREATE INDEX idx_bag_user ON public.bag_items(user_id);
CREATE INDEX idx_orders_user ON public.orders(user_id);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_services_active_rank ON public.services(is_active, popularity_rank);
