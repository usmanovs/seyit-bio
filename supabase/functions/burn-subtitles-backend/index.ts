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
    console.log('[BURN-SUBTITLES] Processing video:', videoPath);

    if (!videoPath || !subtitles) {
      throw new Error('Missing videoPath or subtitles');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get video public URL
    const { data: { publicUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(videoPath);

    console.log('[BURN-SUBTITLES] Video URL:', publicUrl);

    // Use Replicate API for video processing with FFmpeg
    // This requires setting up a Replicate account and getting an API token
    const replicateToken = Deno.env.get('REPLICATE_API_TOKEN');
    
    if (!replicateToken) {
      console.log('[BURN-SUBTITLES] No Replicate token found, returning URLs for manual processing');
      return new Response(
        JSON.stringify({
          success: false,
          needsSetup: true,
          message: "Backend video processing requires Replicate API setup",
          videoUrl: publicUrl,
          subtitles: subtitles
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create SRT file in storage for processing
    const srtFileName = videoPath.replace(/\.[^/.]+$/, '') + '_subtitles.srt';
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(srtFileName, new Blob([subtitles], { type: 'text/plain' }), {
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl: srtUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(srtFileName);

    console.log('[BURN-SUBTITLES] SRT URL:', srtUrl);

    // Call Replicate API for video processing
    const prediction = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${replicateToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: "your-ffmpeg-model-version-here", // Would need to be set up
        input: {
          video: publicUrl,
          subtitles: srtUrl
        }
      })
    });

    const predictionData = await prediction.json();
    console.log('[BURN-SUBTITLES] Prediction started:', predictionData.id);

    return new Response(
      JSON.stringify({
        success: true,
        predictionId: predictionData.id,
        message: "Video processing started. This may take a few minutes."
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[BURN-SUBTITLES] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
