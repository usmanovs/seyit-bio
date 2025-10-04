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

  let requestId = 'unknown';
  try {
    const body = await req.json();
    requestId = body.requestId || `backend_${Date.now()}`;
    
    console.log(`[${requestId}] BACKEND REQUEST`, {
      hasPredictionId: !!body.predictionId,
      hasVideoPath: !!body.videoPath,
      hasSubtitles: !!body.subtitles,
      timestamp: new Date().toISOString()
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const replicateToken = Deno.env.get('REPLICATE_API_KEY');
    
    if (!replicateToken) {
      console.error(`[${requestId}] CONFIGURATION ERROR: No Replicate token found`);
      throw new Error('REPLICATE_API_KEY is not configured');
    }

    const replicate = new Replicate({
      auth: replicateToken,
    });

    // Case 1: Status polling - if body contains predictionId
    if (body.predictionId) {
      const predictionId = body.predictionId;
      console.log(`[${requestId}] STATUS CHECK for prediction: ${predictionId}`);
      
      const prediction = await replicate.predictions.get(predictionId);
      console.log(`[${requestId}] Current status: ${prediction.status}`);

      if (prediction.status === 'succeeded') {
        const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
        console.log(`[${requestId}] PREDICTION SUCCESS`, {
          predictionId,
          outputUrl: outputUrl?.substring(0, 50) + '...',
          timestamp: new Date().toISOString()
        });
        return new Response(
          JSON.stringify({ success: true, status: prediction.status, videoUrl: outputUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (prediction.status === 'failed') {
        const errorMessage = prediction.error ?? 'Video processing failed';
        console.error(`[${requestId}] PREDICTION FAILED`, {
          predictionId,
          error: errorMessage,
          logs: prediction.logs,
          timestamp: new Date().toISOString()
        });
        console.error(`[${requestId}] Full prediction:`, JSON.stringify(prediction, null, 2));
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            status: prediction.status, 
            error: errorMessage,
            details: prediction.logs || 'No additional details available'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Still processing
      console.log(`[${requestId}] Still processing (status: ${prediction.status})`);
      return new Response(
        JSON.stringify({ success: true, status: prediction.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Case 2: Start new job - body contains videoPath and subtitles
    const { videoPath, subtitles } = body;
    
    if (!videoPath || !subtitles) {
      console.error(`[${requestId}] VALIDATION ERROR: Missing videoPath or subtitles`);
      throw new Error('Missing videoPath or subtitles');
    }

    console.log(`[${requestId}] JOB INITIATION`, {
      videoPath,
      subtitlesLength: subtitles.length,
      timestamp: new Date().toISOString()
    });

    // Get video public URL
    const { data: { publicUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(videoPath);

    console.log(`[${requestId}] Video URL retrieved:`, publicUrl.substring(0, 50) + '...');

    // Create a temporary SRT file content - normalize spacing to avoid extra gaps
    // First, clean any markdown code fences from the subtitles
    let cleanSubtitles = subtitles.trim();
    if (cleanSubtitles.startsWith('```')) {
      cleanSubtitles = cleanSubtitles.replace(/^```[a-z]*\n/, '').replace(/\n?```$/, '');
    }
    
    const srtContent = cleanSubtitles
      .split('\n')
      .map((line: string) => {
        const isTiming = /^\d+:\d+:\d+[,.]\d+\s+-->\s+\d+:\d+:\d+[,.]\d+/.test(line);
        if (isTiming) return line.trim();
        return line
          .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // exotic spaces to normal
          .replace(/[ \t]{2,}/g, ' ') // collapse multiple spaces/tabs
          .trimEnd();
      })
      .join('\n');
    const srtBlob = new Blob([srtContent], { type: 'text/plain' });
    const srtFileName = `subtitles_${Date.now()}.srt`;
    
    console.log(`[${requestId}] SRT file prepared`, {
      fileName: srtFileName,
      sizeBytes: srtBlob.size,
      timestamp: new Date().toISOString()
    });
    
    // Upload SRT to storage temporarily
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(`temp/${srtFileName}`, srtBlob, {
        contentType: 'text/plain',
        upsert: true
      });

    if (uploadError) {
      console.error(`[${requestId}] SRT UPLOAD ERROR`, uploadError);
      throw new Error('Failed to upload subtitle file');
    }
    
    console.log(`[${requestId}] SRT uploaded successfully to temp/${srtFileName}`);

    const { data: { publicUrl: srtUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(`temp/${srtFileName}`);

    console.log(`[${requestId}] SRT URL:`, srtUrl.substring(0, 50) + '...');

      // Create clean, readable subtitle style based on user's selection
      let enhancedPrompt = body.stylePrompt || 'white text with black outline, bold font';
      
      // Fix problematic style prompts to ensure readability
      if (enhancedPrompt.includes('solid black background')) {
        enhancedPrompt = enhancedPrompt.replace('solid black background', 'semi-transparent dark background (70% opacity)');
      }
      if (enhancedPrompt.includes('green border box')) {
        enhancedPrompt = enhancedPrompt.replace('green border box', 'subtle border');
      }
      
      // Ensure normal word/letter spacing
      enhancedPrompt += '. Use normal word spacing and letter spacing (no extra gaps between words).';
      
      // Start Replicate job using predictions API so we can poll from the client
      const prediction = await replicate.predictions.create({
        model: 'fofr/smart-ffmpeg',
        input: {
          files: [publicUrl, srtUrl],
          prompt: `CRITICAL AUDIO REQUIREMENT: Use -c:a copy to preserve the original audio codec without re-encoding. MUST keep original audio stream intact with all codecs (AAC, MP3, etc). Do not transcode or modify audio in any way.

Subtitle instructions: Burn the subtitles from the SRT file onto the video at the VERY BOTTOM with only small padding from bottom edge (92-96% from top). Style: ${enhancedPrompt}. Text must be clearly readable and visible. Use appropriate font size (16-20px). Background should be semi-transparent if present, never fully opaque. Ensure high contrast between text and any background. Subtitles must be positioned at the absolute bottom like standard video players, with minimal margin from bottom edge. Ensure normal spacing between words (no extra gaps).

FFmpeg command must include: -c:a copy -map 0:a? to preserve all audio streams without modification.`,
          max_attempts: 3,
        },
      } as any);

    console.log(`[${requestId}] REPLICATE JOB CREATED`, {
      predictionId: prediction.id,
      model: 'fofr/smart-ffmpeg',
      stylePrompt: enhancedPrompt,
      timestamp: new Date().toISOString()
    });

    // Return immediately with predictionId for client-side polling
    return new Response(
      JSON.stringify({ success: true, predictionId: prediction.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 }
    );

  } catch (error: any) {
    console.error(`[${requestId}] BACKEND ERROR`, {
      error: error.message,
      stack: error.stack?.substring(0, 200),
      timestamp: new Date().toISOString()
    });
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
