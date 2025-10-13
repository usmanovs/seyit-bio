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
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
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
    const { videoPath, subtitles, fontUrls } = body;
    
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
          .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
          .replace(/\uFE0F/g, '') // strip emoji variation selector to improve fallback rendering
          .replace(/\uFE0E/g, '') // strip text variation selector if present
          .replace(/[ \t]{2,}/g, ' ')
          .trimEnd();
      })
      .join('\n');
    const srtBlob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
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

    // Style mapping: CSS preview styles to ASS parameters
    // These parameters are precisely calibrated to match the browser preview
    const styleId = body.styleId || 'outline';
    const styleMapping: Record<string, any> = {
      // Stroke style: White text with thick black outline (matches 2em, bold, 4px shadow in 8 directions)
      outline: {
        FontName: 'Noto Emoji',
        FontSize: 20,  // Further reduced for better readability
        PrimaryColour: '&HFFFFFF',  // White
        Bold: 1,
        Italic: 0,
        Underline: 0,
        Spacing: 0,  // CRITICAL: No letter spacing
        Outline: 3,  // Thick outline
        OutlineColour: '&H000000',  // Black
        Shadow: 0,  // No drop shadow, just outline
        BackColour: '&H00000000',  // Transparent
        BorderStyle: 1,  // Outline only
        Alignment: 2,  // Bottom center
        MarginL: 20,
        MarginR: 20,
        MarginV: 40,
      },
      // Subtle style: Light text with semi-transparent background (matches 1.3em, weight 300)
      minimal: {
        FontName: 'Noto Emoji',
        FontSize: 18,  // Further reduced
        PrimaryColour: '&HFFFFFF',  // White
        Bold: 0,  // Light weight
        Italic: 0,
        Underline: 0,
        Spacing: 0,
        Outline: 1,  // Minimal outline
        OutlineColour: '&H000000',
        Shadow: 1,  // Subtle shadow
        BackColour: '&HB3000000',  // Semi-transparent black (0.7 opacity = B3 in hex)
        BorderStyle: 4,  // Background box
        Alignment: 2,
        MarginL: 20,
        MarginR: 20,
        MarginV: 40,
      },
      // Highlight style: Black text with yellow glow and white outline (matches weight 900)
      green: {
        FontName: 'Noto Emoji',
        FontSize: 22,  // Further reduced
        PrimaryColour: '&H000000',  // Black text
        Bold: 1,
        Italic: 0,
        Underline: 0,
        Spacing: 0,
        Outline: 2,  // White outline (2px to match CSS)
        OutlineColour: '&HFFFFFF',  // White outline
        Shadow: 6,  // Yellow glow effect
        SecondaryColour: '&H00B3EA',  // Yellow for glow (EAB300 in BGR)
        BackColour: '&H00000000',  // Transparent
        BorderStyle: 1,
        Alignment: 2,
        MarginL: 20,
        MarginR: 20,
        MarginV: 40,
      },
      // Framed style: Bright green text with border and glow (matches 1.6em, bold, green border)
      boxed: {
        FontName: 'Noto Emoji',
        FontSize: 24,  // Further reduced
        PrimaryColour: '&H00FF00',  // Bright green (00FF00 in BGR)
        Bold: 1,
        Italic: 0,
        Underline: 0,
        Spacing: 0,
        Outline: 4,  // Thick border to match 4px CSS border
        OutlineColour: '&H00FF00',  // Green border
        Shadow: 4,  // Green glow
        BackColour: '&HF2000000',  // Nearly solid black (0.95 opacity = F2 in hex)
        BorderStyle: 4,  // Background box with border
        Alignment: 2,
        MarginL: 20,
        MarginR: 20,
        MarginV: 40,
      },
    };

    const style = styleMapping[styleId] || styleMapping.outline;
    console.log(`[${requestId}] Using style: ${styleId}`, style);

    // Build force_style string from style parameters (exclude FontName as we'll add it explicitly)
    const forceStyleParams = Object.entries(style)
      .filter(([key]) => key !== 'FontName')
      .map(([key, value]) => `${key}=${value}`)
      .join(',');

    console.log(`[${requestId}] Force style string:`, forceStyleParams);

    // Build files array - include fonts if provided (emoji support)
    const files = [publicUrl, srtUrl];
    if (fontUrls && Array.isArray(fontUrls)) {
      console.log(`[${requestId}] Adding ${fontUrls.length} font URL(s):`, fontUrls);
      files.push(...fontUrls);
    }

    // Start Replicate job using predictions API with retry logic
    let prediction;
    let retries = 3;
    let lastError;
    
    while (retries > 0) {
      try {
        prediction = await replicate.predictions.create({
          model: 'fofr/smart-ffmpeg',
          input: {
            files,
            prompt: `Execute this FFmpeg command to burn subtitles:

STEP 1 - Rename files:
mv *.srt subs.srt

STEP 2 - Run FFmpeg with these exact parameters:
ffmpeg -y -i *.MP4 -vf "subtitles=subs.srt:charenc=UTF-8:fontsdir=.:force_style='FontName=${style.FontName},${forceStyleParams}'" -c:v libx264 -crf 15 -preset slow -profile:v high -level 4.1 -pix_fmt yuv420p -c:a copy -movflags +faststart output.mp4

CRITICAL:
- Use single quotes around force_style value
- Include charenc=UTF-8 for emoji support
- Set fontsdir=. so all provided TTFs are available (do NOT rename fonts)
- Copy audio stream with -c:a copy
- Output file must be named output.mp4`,
            max_attempts: 2,
          },
        } as any);
        
        // Success - break the retry loop
        break;
      } catch (err: any) {
        lastError = err;
        retries--;
        console.error(`[${requestId}] Replicate API error (${3 - retries}/3 attempts):`, err.message);
        
        if (retries > 0) {
          // Wait before retry with exponential backoff
          const waitTime = (4 - retries) * 2000; // 2s, 4s, 6s
          console.log(`[${requestId}] Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    if (!prediction) {
      console.error(`[${requestId}] Failed to create prediction after 3 attempts:`, lastError);
      throw new Error(`Replicate API failed: ${lastError?.message || 'Unknown error'}`);
    }

    console.log(`[${requestId}] REPLICATE JOB CREATED`, {
      predictionId: prediction.id,
      model: 'fofr/smart-ffmpeg',
      styleId: styleId,
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
    // Return 200 with error details instead of 500 to avoid triggering "non-2xx" errors
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: 'Video processing failed. Please try again or contact support if the issue persists.'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
