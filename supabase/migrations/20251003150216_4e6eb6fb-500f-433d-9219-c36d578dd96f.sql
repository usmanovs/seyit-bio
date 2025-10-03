-- Add DELETE policy to profiles table
-- Only admins can delete profiles to maintain data integrity and compliance

CREATE POLICY "Only admins can delete profiles"
ON public.profiles
FOR DELETE
USING (is_admin(auth.uid()));