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

    const replicate = new Replicate({
      auth: replicateToken,
    });

    console.log('[BURN-SUBTITLES] Starting Replicate video processing');

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

    // Call Replicate API using smart-ffmpeg model
    const output = await replicate.run(
      "fofr/smart-ffmpeg",
      {
        input: {
          files: [publicUrl, srtUrl],
          prompt: "Burn the subtitles from the SRT file onto the video at the bottom center with a black background for readability",
          max_attempts: 3
        }
      }
    );

    console.log('[BURN-SUBTITLES] Replicate processing complete:', output);

    if (!output) {
      throw new Error('No output from Replicate');
    }

    // Clean up temporary SRT file
    try {
      await supabase.storage.from('videos').remove([`temp/${srtFileName}`]);
    } catch (cleanupError) {
      console.log('[BURN-SUBTITLES] Cleanup warning:', cleanupError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: Array.isArray(output) ? output[0] : output,
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
