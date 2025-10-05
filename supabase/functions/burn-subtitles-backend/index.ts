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

    // Style mapping: CSS preview styles to ASS parameters
    // Adjusted based on actual video output feedback
    const styleId = body.styleId || 'outline';
    
    console.log(`[${requestId}] Style selection received:`, {
      receivedStyleId: body.styleId,
      usingStyleId: styleId,
      timestamp: new Date().toISOString()
    });
    
    const styleMapping: Record<string, any> = {
      // Stroke style: White text with thick black outline
      outline: {
        FontName: 'Noto Color Emoji,Apple Color Emoji,Segoe UI Emoji,Symbola,Noto Sans,Arial',
        FontSize: 16,  // Much smaller for better readability
        PrimaryColour: '&HFFFFFF',  // White
        Bold: 1,
        Italic: 0,
        Underline: 0,
        Spacing: 0,
        Outline: 2,  // Reduced outline thickness
        OutlineColour: '&H000000',  // Black
        Shadow: 0,
        BackColour: '&H00000000',  // Transparent
        BorderStyle: 1,
        Alignment: 2,
        MarginL: 20,
        MarginR: 20,
        MarginV: 30,
      },
      // Subtle style: Light text with semi-transparent background
      minimal: {
        FontName: 'Noto Color Emoji,Apple Color Emoji,Segoe UI Emoji,Symbola,Noto Sans,Arial',
        FontSize: 14,
        PrimaryColour: '&HFFFFFF',  // White
        Bold: 0,
        Italic: 0,
        Underline: 0,
        Spacing: 0,
        Outline: 1,
        OutlineColour: '&H000000',
        Shadow: 1,
        BackColour: '&HB3000000',  // Semi-transparent black
        BorderStyle: 4,  // Background box
        Alignment: 2,
        MarginL: 20,
        MarginR: 20,
        MarginV: 30,
      },
      // Highlight style: Black text with yellow glow and white outline
      green: {
        FontName: 'Noto Color Emoji,Apple Color Emoji,Segoe UI Emoji,Symbola,Noto Sans,Arial',
        FontSize: 18,
        PrimaryColour: '&H000000',  // Black text
        Bold: 1,
        Italic: 0,
        Underline: 0,
        Spacing: 0,
        Outline: 2,
        OutlineColour: '&HFFFFFF',  // White outline
        Shadow: 4,  // Yellow glow effect
        SecondaryColour: '&H00B3EA',  // Yellow for glow
        BackColour: '&H00000000',  // Transparent
        BorderStyle: 1,
        Alignment: 2,
        MarginL: 20,
        MarginR: 20,
        MarginV: 30,
      },
      // Framed style: Bright green text with border and glow
      boxed: {
        FontName: 'Noto Color Emoji,Apple Color Emoji,Segoe UI Emoji,Symbola,Noto Sans,Arial',
        FontSize: 18,
        PrimaryColour: '&H00FF00',  // Bright green
        Bold: 1,
        Italic: 0,
        Underline: 0,
        Spacing: 0,
        Outline: 3,
        OutlineColour: '&H00FF00',  // Green border
        Shadow: 3,  // Green glow
        BackColour: '&HF2000000',  // Nearly solid black
        BorderStyle: 4,  // Background box with border
        Alignment: 2,
        MarginL: 20,
        MarginR: 20,
        MarginV: 30,
      },
    };

    const style = styleMapping[styleId] || styleMapping.outline;
    console.log(`[${requestId}] Using style: ${styleId}`, style);

    // Build force_style string from style parameters
    const forceStyleParams = Object.entries(style)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');

    console.log(`[${requestId}] Force style string:`, forceStyleParams);

    // Emoji font to ensure glyph coverage (will be downloaded by the job)
    const emojiFontUrl = 'https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf';
    
    console.log(`[${requestId}] Emoji font URL:`, emojiFontUrl);

    // Start Replicate job using predictions API
    const prediction = await replicate.predictions.create({
      model: 'fofr/smart-ffmpeg',
      input: {
        files: [publicUrl, srtUrl, emojiFontUrl],
        prompt: `CRITICAL: Generate an FFmpeg command that burns SRT subtitles onto the video with emoji support.

FILES PROVIDED:
- Video file at: ${publicUrl}
- Subtitles file at: ${srtFileName}
- Emoji font file: NotoColorEmoji.ttf (downloaded from files)

EXACT FFmpeg command structure required:
ffmpeg -i "${publicUrl}" -vf "subtitles='${srtFileName}':fontsdir=.:force_style='${forceStyleParams}'" -c:v libx264 -crf 18 -preset slow -profile:v high -level 4.1 -pix_fmt yuv420p -c:a copy -movflags +faststart output.mp4

CRITICAL FONT SETUP:
1. Download the emoji font NotoColorEmoji.ttf to the current working directory
2. Set up font directory: mkdir -p ~/.fonts && cp NotoColorEmoji.ttf ~/.fonts/ && fc-cache -f -v
3. Verify font is available: fc-list | grep -i "noto"
4. Use subtitles filter with fontsdir=. to reference downloaded fonts
5. The FontName in force_style includes multiple fallback fonts - ensure all are accessible

ENCODING RULES:
1. Use the EXACT force_style string provided - do NOT modify it
2. Keep Spacing=0 (no letter tracking adjustments)
3. Maintain original video resolution and framerate
4. Audio: -c:a copy (stream copy, no re-encoding)
5. Ensure emoji glyphs render by using the Noto Color Emoji font first in fallback chain

STYLE INFO:
- Style: ${styleId}
- Font size: ${style.FontSize}
- Has background box: ${style.BorderStyle === 4 ? 'yes' : 'no'}
- Font fallback chain: ${style.FontName}

DEBUG: Log the actual FFmpeg command before execution to verify font setup.
`,
        max_attempts: 3,
      },
    } as any);

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
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
