-- Fix contact_submissions table security
-- Add policies to prevent unauthorized modification or deletion of contact submissions

CREATE POLICY "No one can update contact submissions"
ON public.contact_submissions
FOR UPDATE
USING (false);

CREATE POLICY "No one can delete contact submissions"
ON public.contact_submissions
FOR DELETE
USING (false);

-- Fix user_roles table security to prevent privilege escalation
-- Only allow role management through secure server-side operations

CREATE POLICY "Prevent unauthorized role insertion"
ON public.user_roles
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Prevent unauthorized role updates"
ON public.user_roles
FOR UPDATE
USING (false);

CREATE POLICY "Prevent unauthorized role deletion"
ON public.user_roles
FOR DELETE
USING (false);