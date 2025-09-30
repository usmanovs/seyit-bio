-- Create contact_submissions table
CREATE TABLE public.contact_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to submit a contact form (public form)
CREATE POLICY "Anyone can submit contact form"
ON public.contact_submissions
FOR INSERT
TO public
WITH CHECK (true);

-- Only authenticated users can view submissions (for admin purposes)
CREATE POLICY "Authenticated users can view submissions"
ON public.contact_submissions
FOR SELECT
TO authenticated
USING (true);