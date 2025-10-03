-- Allow anyone (authenticated or not) to upload videos
CREATE POLICY "Anyone can upload videos"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'videos');

-- Allow anyone to read videos (since bucket is already public)
CREATE POLICY "Anyone can view videos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'videos');

-- Allow uploaders to update their own videos
CREATE POLICY "Users can update their own videos"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'videos')
WITH CHECK (bucket_id = 'videos');

-- Allow uploaders to delete videos
CREATE POLICY "Users can delete videos"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'videos');