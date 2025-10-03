-- Add UPDATE policy for video_subtitles table
-- This allows users to update their own subtitle records securely
CREATE POLICY "Users can update their own subtitles"
ON public.video_subtitles
FOR UPDATE
USING (auth.uid() = user_id);