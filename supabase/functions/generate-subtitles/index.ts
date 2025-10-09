import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert timestamps to SRT format (HH:MM:SS,mmm)
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

// Generate SRT subtitle file from segments
function generateSRT(segments: any[]): string {
  return segments.map((segment, index) => {
    const startTime = formatTimestamp(segment.start);
    const endTime = formatTimestamp(segment.end);
    const text = segment.text.trim();
    
    return `${index + 1}\n${startTime} --> ${endTime}\n${text}\n`;
  }).join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const language = formData.get('language') as string | null;
    
    if (!file) {
      throw new Error('No file provided');
    }

    console.log('[GENERATE-SUBTITLES] Processing file:', file.name, 'Size:', file.size);
    if (language) {
      console.log('[GENERATE-SUBTITLES] Target language:', language);
    }

    // Prepare form data for OpenAI
    const openaiFormData = new FormData();
    openaiFormData.append('file', file);
    openaiFormData.append('model', 'whisper-1');
    
    // Add language parameter if specified
    if (language) {
      openaiFormData.append('language', language);
    }
    
    openaiFormData.append('response_format', 'verbose_json'); // Get timestamps
    openaiFormData.append('timestamp_granularities[]', 'segment'); // Get segment timestamps

    console.log('[GENERATE-SUBTITLES] Calling OpenAI Whisper API...');

    // Send to OpenAI Whisper
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: openaiFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GENERATE-SUBTITLES] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const result = await response.json();
    console.log('[GENERATE-SUBTITLES] Transcription successful');

    // Generate SRT subtitle file
    const srtContent = generateSRT(result.segments);
    
    return new Response(
      JSON.stringify({ 
        text: result.text,
        srt: srtContent,
        language: result.language,
        duration: result.duration
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[GENERATE-SUBTITLES] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
