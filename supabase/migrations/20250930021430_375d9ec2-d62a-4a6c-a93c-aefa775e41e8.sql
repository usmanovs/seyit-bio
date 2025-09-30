-- Step 1: Create an enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Step 2: Create user_roles table to manage admin access
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role public.app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Only admins can view user roles
CREATE POLICY "Only admins can view user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Step 3: Create security definer function to check admin role
-- This prevents infinite recursion in RLS policies
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_roles.user_id = is_admin.user_id
        AND role = 'admin'
    );
$$;

-- Step 4: Drop the overly permissive SELECT policy on contact_submissions
DROP POLICY IF EXISTS "Authenticated users can view submissions" ON public.contact_submissions;

-- Step 5: Create admin-only SELECT policy for contact_submissions
CREATE POLICY "Only admins can view contact submissions"
ON public.contact_submissions
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Step 6: Add a comment to document the security model
COMMENT ON TABLE public.contact_submissions IS 'Contact form submissions - only viewable by administrators to protect customer privacy';