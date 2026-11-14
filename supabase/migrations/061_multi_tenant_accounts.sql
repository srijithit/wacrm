-- ============================================================
-- 061_multi_tenant_accounts.sql — Multi-tenant support for accounts
-- ============================================================

-- 1. Remove the single-account-per-owner constraint so an owner can manage multiple tenants
DROP INDEX IF EXISTS idx_accounts_one_per_owner;

-- 2. Update RLS on accounts to permit owners to view and manage their accounts
DROP POLICY IF EXISTS accounts_select ON accounts;
CREATE POLICY accounts_select ON accounts FOR SELECT
  USING (is_account_member(id) OR owner_user_id = auth.uid());

DROP POLICY IF EXISTS accounts_insert ON accounts;
CREATE POLICY accounts_insert ON accounts FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS accounts_update ON accounts;
CREATE POLICY accounts_update ON accounts FOR UPDATE
  USING (is_account_member(id, 'admin') OR owner_user_id = auth.uid())
  WITH CHECK (is_account_member(id, 'admin') OR owner_user_id = auth.uid());

DROP POLICY IF EXISTS accounts_delete ON accounts;
CREATE POLICY accounts_delete ON accounts FOR DELETE
  USING (owner_user_id = auth.uid());

-- 3. Stored procedure to create a new tenant account and switch the caller to it
CREATE OR REPLACE FUNCTION public.create_tenant(p_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_account_id UUID;
  v_trimmed_name TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_trimmed_name := btrim(COALESCE(p_name, ''));
  IF v_trimmed_name = '' THEN
    RAISE EXCEPTION 'Tenant name cannot be empty';
  END IF;

  INSERT INTO public.accounts (name, owner_user_id)
  VALUES (v_trimmed_name, v_user_id)
  RETURNING id INTO v_account_id;

  -- Switch active account to the newly created tenant
  UPDATE public.profiles
  SET account_id = v_account_id,
      account_role = 'owner'
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'id', v_account_id,
    'name', v_trimmed_name,
    'role', 'owner'
  );
END;
$$;

ALTER FUNCTION public.create_tenant(TEXT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.create_tenant(TEXT) TO authenticated;

-- 4. Stored procedure to switch active tenant account
CREATE OR REPLACE FUNCTION public.switch_account(target_account_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_owner BOOLEAN;
  v_role account_role_enum;
  v_account_name TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT name, (owner_user_id = v_user_id)
  INTO v_account_name, v_is_owner
  FROM public.accounts
  WHERE id = target_account_id;

  IF v_account_name IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  IF v_is_owner THEN
    v_role := 'owner';
  ELSE
    SELECT account_role INTO v_role
    FROM public.profiles
    WHERE user_id = v_user_id AND account_id = target_account_id;

    IF v_role IS NULL THEN
      RAISE EXCEPTION 'You are not a member of this account';
    END IF;
  END IF;

  UPDATE public.profiles
  SET account_id = target_account_id,
      account_role = v_role
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'account_id', target_account_id,
    'account_name', v_account_name,
    'role', v_role
  );
END;
$$;

ALTER FUNCTION public.switch_account(UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.switch_account(UUID) TO authenticated;

-- 5. Stored procedure to list all tenants accessible to caller
CREATE OR REPLACE FUNCTION public.list_tenants()
RETURNS TABLE (
  id UUID,
  name TEXT,
  owner_user_id UUID,
  created_at TIMESTAMPTZ,
  is_current BOOLEAN,
  is_owner BOOLEAN,
  member_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 
    a.id,
    a.name,
    a.owner_user_id,
    a.created_at,
    (p.account_id = a.id) AS is_current,
    (a.owner_user_id = auth.uid()) AS is_owner,
    (SELECT count(*) FROM public.profiles m WHERE m.account_id = a.id) AS member_count
  FROM public.accounts a
  LEFT JOIN public.profiles p ON p.user_id = auth.uid()
  WHERE a.owner_user_id = auth.uid() OR a.id = p.account_id
  ORDER BY a.created_at ASC;
$$;

ALTER FUNCTION public.list_tenants() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.list_tenants() TO authenticated;

-- 6. Stored procedure to delete a tenant
CREATE OR REPLACE FUNCTION public.delete_tenant(target_account_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_primary_account_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = target_account_id AND owner_user_id = v_user_id) THEN
    RAISE EXCEPTION 'Only the owner can delete this tenant';
  END IF;

  IF (SELECT count(*) FROM public.accounts WHERE owner_user_id = v_user_id) <= 1 THEN
    RAISE EXCEPTION 'Cannot delete your only tenant account';
  END IF;

  SELECT id INTO v_primary_account_id
  FROM public.accounts
  WHERE owner_user_id = v_user_id AND id <> target_account_id
  ORDER BY created_at ASC
  LIMIT 1;

  UPDATE public.profiles
  SET account_id = v_primary_account_id,
      account_role = 'owner'
  WHERE user_id = v_user_id AND account_id = target_account_id;

  DELETE FROM public.accounts WHERE id = target_account_id;

  RETURN TRUE;
END;
$$;

ALTER FUNCTION public.delete_tenant(UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.delete_tenant(UUID) TO authenticated;
