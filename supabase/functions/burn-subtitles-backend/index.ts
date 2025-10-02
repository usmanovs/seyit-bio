import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Replicate from "https://esm.sh/replicate@0.25.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('[BURN-SUBTITLES] Request body:', body);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const replicateToken = Deno.env.get('REPLICATE_API_KEY');
    
    if (!replicateToken) {
      console.log('[BURN-SUBTITLES] No Replicate token found');
      throw new Error('REPLICATE_API_KEY is not configured');
    }

    const replicate = new Replicate({
      auth: replicateToken,
    });

    // Case 1: Status polling - if body contains predictionId
    if (body.predictionId) {
      const predictionId = body.predictionId;
      console.log('[BURN-SUBTITLES] Checking status for:', predictionId);
      
      const prediction = await replicate.predictions.get(predictionId);
      console.log('[BURN-SUBTITLES] Status:', prediction.status);

      if (prediction.status === 'succeeded') {
        const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
        return new Response(
          JSON.stringify({ success: true, status: prediction.status, videoUrl: outputUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (prediction.status === 'failed') {
        return new Response(
          JSON.stringify({ success: false, status: prediction.status, error: prediction.error ?? 'Video processing failed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Still processing
      return new Response(
        JSON.stringify({ success: true, status: prediction.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Case 2: Start new job - body contains videoPath and subtitles
    const { videoPath, subtitles } = body;
    
    if (!videoPath || !subtitles) {
      throw new Error('Missing videoPath or subtitles');
    }

    console.log('[BURN-SUBTITLES] Starting new job for video:', videoPath);

    // Get video public URL
    const { data: { publicUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(videoPath);

    console.log('[BURN-SUBTITLES] Video URL:', publicUrl);

    // Create a temporary SRT file content
    const srtContent = subtitles;
    const srtBlob = new Blob([srtContent], { type: 'text/plain' });
    const srtFileName = `subtitles_${Date.now()}.srt`;
    
    // Upload SRT to storage temporarily
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(`temp/${srtFileName}`, srtBlob, {
        contentType: 'text/plain',
        upsert: true
      });

    if (uploadError) {
      console.error('[BURN-SUBTITLES] SRT upload error:', uploadError);
      throw new Error('Failed to upload subtitle file');
    }

    const { data: { publicUrl: srtUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(`temp/${srtFileName}`);

    console.log('[BURN-SUBTITLES] SRT URL:', srtUrl);

    // Start Replicate job using predictions API so we can poll from the client
    const prediction = await replicate.predictions.create({
      version: 'fofr/smart-ffmpeg',
      input: {
        files: [publicUrl, srtUrl],
        prompt: 'Burn the subtitles from the SRT file onto the video at the bottom center. Use white text with a yellow highlight/glow effect, bold font, 18px size, with a semi-transparent black background box for readability. Add a subtle shadow to make text pop.',
        max_attempts: 3,
      },
    } as any);

    console.log('[BURN-SUBTITLES] Prediction created:', prediction.id);

    // Return immediately with predictionId for client-side polling
    return new Response(
      JSON.stringify({ success: true, predictionId: prediction.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 }
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
