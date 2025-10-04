-- Add videos_processed_count column to profiles table
ALTER TABLE public.profiles
ADD COLUMN videos_processed_count integer NOT NULL DEFAULT 0;

-- Create function to increment video processing count
CREATE OR REPLACE FUNCTION public.increment_video_processing_count(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET videos_processed_count = videos_processed_count + 1,
      updated_at = now()
  WHERE id = user_uuid;
END;
$$;