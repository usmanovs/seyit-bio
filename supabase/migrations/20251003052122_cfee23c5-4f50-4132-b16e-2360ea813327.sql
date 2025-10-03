-- Create table for TikTok OAuth tokens
CREATE TABLE public.tiktok_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.tiktok_credentials ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own TikTok credentials"
ON public.tiktok_credentials
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own TikTok credentials"
ON public.tiktok_credentials
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own TikTok credentials"
ON public.tiktok_credentials
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own TikTok credentials"
ON public.tiktok_credentials
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_tiktok_credentials_updated_at
BEFORE UPDATE ON public.tiktok_credentials
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();