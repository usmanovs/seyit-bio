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
        // smart-ffmpeg returns output as a URL or array of URLs
        const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
        console.log(`[${requestId}] PREDICTION SUCCESS`, {
          predictionId,
          outputUrl: outputUrl?.substring(0, 50) + '...',
          timestamp: new Date().toISOString()
        });
        return new Response(
          JSON.stringify({ success: true, status: prediction.status, output: outputUrl }),
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
    
    console.log(`[${requestId}] SRT content prepared`, {
      contentLength: srtContent.length,
      timestamp: new Date().toISOString()
    });

    // Parse SRT and convert to FFmpeg drawtext filters
    function parseTimestamp(timestamp: string): number {
      const [time, ms] = timestamp.replace(',', '.').split('.');
      const [hours, minutes, seconds] = time.split(':').map(Number);
      return hours * 3600 + minutes * 60 + seconds + (ms ? parseFloat(`0.${ms}`) : 0);
    }

    function escapeText(text: string): string {
      return text
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/:/g, '\\:')
        .replace(/\n/g, ' ')
        .trim();
    }

    function buildDrawtextFilters(srtContent: string): string {
      const blocks = srtContent.split(/\n\s*\n/).filter(block => block.trim());
      const filters: string[] = [];

      for (const block of blocks) {
        const lines = block.split('\n').filter(line => line.trim());
        if (lines.length < 3) continue;

        // Line 0: index, Line 1: timing, Line 2+: text
        const timingLine = lines[1];
        const match = timingLine.match(/(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/);
        
        if (!match) continue;

        const startTime = parseTimestamp(match[1]);
        const endTime = parseTimestamp(match[2]);
        const text = lines.slice(2).join(' ');
        
        if (!text.trim()) continue;

        const escapedText = escapeText(text);
        
        // Build drawtext filter for this subtitle
        filters.push(
          `drawtext=text='${escapedText}':fontsize=28:fontcolor=white:borderw=3:bordercolor=black:` +
          `x=(w-text_w)/2:y=h-80:enable='between(t,${startTime},${endTime})'`
        );
      }

      return filters.join(',');
    }

    const drawtextFilters = buildDrawtextFilters(srtContent);
    console.log(`[${requestId}] Generated drawtext filters`, {
      filterCount: drawtextFilters.split(',').length,
      totalLength: drawtextFilters.length,
      timestamp: new Date().toISOString()
    });


    // Start Replicate job using smart-ffmpeg model (async)
    console.log(`[${requestId}] Creating prediction for smart-ffmpeg model with embedded subtitles`);
    
    const prediction = await replicate.predictions.create({
      model: "fofr/smart-ffmpeg",
      input: {
        files: [publicUrl],
        prompt: `Apply this FFmpeg video filter to embed subtitles: ${drawtextFilters}. Keep the original video quality, resolution, and audio. Output as MP4 with H.264 codec.`
      }
    });

    console.log(`[${requestId}] REPLICATE JOB CREATED`, {
      predictionId: prediction.id,
      model: 'fofr/smart-ffmpeg',
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
