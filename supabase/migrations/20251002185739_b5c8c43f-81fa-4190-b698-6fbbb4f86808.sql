-- Create storage bucket for videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true);

-- Create RLS policies for video uploads
CREATE POLICY "Users can upload their own videos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own videos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own videos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create table to store subtitle data
CREATE TABLE public.video_subtitles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_path TEXT NOT NULL,
  subtitle_content TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'ky',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on video_subtitles
ALTER TABLE public.video_subtitles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for video_subtitles
CREATE POLICY "Users can view their own subtitles"
ON public.video_subtitles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subtitles"
ON public.video_subtitles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subtitles"
ON public.video_subtitles
FOR DELETE
USING (auth.uid() = user_id);