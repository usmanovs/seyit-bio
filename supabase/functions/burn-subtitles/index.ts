import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { videoPath, subtitles } = await req.json();

    if (!videoPath || !subtitles) {
      throw new Error('Missing videoPath or subtitles');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get video from storage
    const { data: videoData, error: downloadError } = await supabase.storage
      .from('videos')
      .download(videoPath);

    if (downloadError) throw downloadError;

    // Convert video to base64
    const videoBuffer = await videoData.arrayBuffer();
    const videoBase64 = btoa(String.fromCharCode(...new Uint8Array(videoBuffer)));

    // Convert subtitles to base64
    const subtitlesBase64 = btoa(subtitles);

    // Call FFmpeg API (using a cloud service like api.video or similar)
    // For now, we'll return both files for the client to handle
    // In production, you'd integrate with FFmpeg.wasm or a video processing service
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Video processing requires FFmpeg integration. Downloading video and subtitles separately.",
        videoUrl: supabase.storage.from('videos').getPublicUrl(videoPath).data.publicUrl,
        subtitles: subtitles
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in burn-subtitles:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
