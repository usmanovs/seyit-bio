import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoPath, title, description } = await req.json();
    
    if (!videoPath || !title) {
      throw new Error('Video path and title are required');
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get TikTok credentials
    const { data: credentials, error: credError } = await supabaseClient
      .from('tiktok_credentials')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (credError || !credentials) {
      throw new Error('TikTok not connected. Please authenticate first.');
    }

    // Check if token is expired
    const expiresAt = new Date(credentials.expires_at);
    if (expiresAt <= new Date()) {
      throw new Error('TikTok token expired. Please reconnect your account.');
    }

    // Download video from Supabase Storage
    const { data: videoData, error: downloadError } = await supabaseClient
      .storage
      .from('videos')
      .download(videoPath);

    if (downloadError || !videoData) {
      throw new Error('Failed to download video from storage');
    }

    console.log('Video downloaded, size:', videoData.size);

    // Step 1: Initialize upload
    const initResponse = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post_info: {
          title: title,
          description: description || '',
          privacy_level: 'SELF_ONLY', // Can be changed to PUBLIC_TO_EVERYONE
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoData.size,
        },
      }),
    });

    const initData = await initResponse.json();
    console.log('Init response:', initData);

    if (initData.error) {
      throw new Error(`TikTok API error: ${initData.error.message || initData.error.code}`);
    }

    // Step 2: Upload video
    const uploadUrl = initData.data.upload_url;
    const publishId = initData.data.publish_id;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
      },
      body: videoData,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Video upload failed: ${uploadResponse.statusText}`);
    }

    console.log('Video uploaded successfully');

    // Step 3: Check upload status
    const statusResponse = await fetch(`https://open.tiktokapis.com/v2/post/publish/status/fetch/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publish_id: publishId,
      }),
    });

    const statusData = await statusResponse.json();
    console.log('Status response:', statusData);

    return new Response(
      JSON.stringify({
        success: true,
        publishId: publishId,
        status: statusData.data?.status || 'PROCESSING',
        message: 'Video uploaded to TikTok successfully!',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error publishing to TikTok:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
