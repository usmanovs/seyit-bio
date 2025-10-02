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

    const replicateToken = Deno.env.get('REPLICATE_API_KEY');
    
    if (!replicateToken) {
      console.log('[BURN-SUBTITLES] No Replicate token found');
      throw new Error('REPLICATE_API_KEY is not configured');
    }

    console.log('[BURN-SUBTITLES] Starting Replicate video processing');

    // Call Replicate API for video processing with FFmpeg to burn subtitles
    const prediction = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${replicateToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: "3b3e9c019c30159299e7498f6c4b6c3f1f4bfb4dc56c0b3c5e4d5e6f7a8b9c0d",
        input: {
          video: publicUrl,
          subtitles: subtitles,
          subtitle_position: "bottom"
        }
      })
    });

    if (!prediction.ok) {
      const errorText = await prediction.text();
      console.error('[BURN-SUBTITLES] Replicate API error:', errorText);
      throw new Error(`Replicate API error: ${errorText}`);
    }

    const predictionData = await prediction.json();
    console.log('[BURN-SUBTITLES] Prediction started:', predictionData.id);

    // Poll for completion
    let status = predictionData.status;
    let outputUrl = null;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (status !== 'succeeded' && status !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionData.id}`, {
        headers: {
          'Authorization': `Token ${replicateToken}`,
        }
      });

      const statusData = await statusResponse.json();
      status = statusData.status;
      
      if (status === 'succeeded') {
        outputUrl = statusData.output;
        console.log('[BURN-SUBTITLES] Processing completed:', outputUrl);
      } else if (status === 'failed') {
        console.error('[BURN-SUBTITLES] Processing failed:', statusData.error);
        throw new Error('Video processing failed');
      }
      
      attempts++;
    }

    if (!outputUrl) {
      throw new Error('Video processing timed out');
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: outputUrl,
        message: "Video processed successfully with burned subtitles"
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
