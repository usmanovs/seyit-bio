import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

function generateSRT(transcription: any): string {
  let srtContent = '';
  let index = 1;
  
  if (transcription.words && transcription.words.length > 0) {
    // Group words into subtitle chunks (every 10 words or by sentence boundaries)
    let currentChunk: any[] = [];
    let chunkStartTime = 0;
    
    for (let i = 0; i < transcription.words.length; i++) {
      const word = transcription.words[i];
      
      if (currentChunk.length === 0) {
        chunkStartTime = word.start || 0;
      }
      
      currentChunk.push(word);
      
      // Create subtitle after 5 words or if sentence ends (reduced from 10 to prevent long lines)
      if (currentChunk.length >= 5 || word.text?.match(/[.!?]$/) || i === transcription.words.length - 1) {
        const endTime = word.end || word.start || 0;
        const text = currentChunk.map(w => (w.text || '').trim()).filter(t => t).join(' ');
        
        srtContent += `${index}\n`;
        srtContent += `${formatTimestamp(chunkStartTime)} --> ${formatTimestamp(endTime)}\n`;
        srtContent += `${text}\n\n`;
        
        index++;
        currentChunk = [];
      }
    }
  } else {
    // Fallback: create one subtitle with the full text
    srtContent = `1\n00:00:00,000 --> 00:00:10,000\n${transcription.text}\n\n`;
  }
  
  return srtContent;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const apikey = req.headers.get('apikey') || req.headers.get('x-apikey');
    console.log('[KYRGYZ-SUBTITLES] Incoming headers:', {
      hasAuth: !!authHeader,
      authPrefix: authHeader ? authHeader.slice(0, 20) + '...' : null,
      hasApiKey: !!apikey,
    });

    // Try to decode user id from JWT if present (optional for guest users)
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.sub || payload.user_id || null;
      } catch (e) {
        console.error('[KYRGYZ-SUBTITLES] Failed to decode JWT payload');
      }
    }
    console.log('[KYRGYZ-SUBTITLES] Decoded userId:', userId, '(guest user if null)');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      authHeader ? { global: { headers: { Authorization: authHeader } } } : {}
    );

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not set');
    }

    const { videoPath, addEmojis = false, correctSpelling = true } = await req.json();

    if (!videoPath) {
      throw new Error('Video path is required');
    }
    
    console.log('[KYRGYZ-SUBTITLES] addEmojis flag:', addEmojis);
    console.log('[KYRGYZ-SUBTITLES] correctSpelling flag:', correctSpelling);

    console.log('[KYRGYZ-SUBTITLES] Processing video:', videoPath);

    // Get a signed URL for direct access (avoids loading entire file into memory)
    let signedUrlData, signedUrlError;
    try {
      const result = await supabaseClient
        .storage
        .from('videos')
        .createSignedUrl(videoPath, 3600); // 1 hour expiry
      
      signedUrlData = result.data;
      signedUrlError = result.error;
      
      console.log('[KYRGYZ-SUBTITLES] Signed URL result:', { 
        hasData: !!signedUrlData, 
        hasError: !!signedUrlError,
        errorMessage: signedUrlError?.message 
      });
    } catch (e) {
      console.error('[KYRGYZ-SUBTITLES] Exception creating signed URL:', e);
      throw new Error(`Exception creating signed URL: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('[KYRGYZ-SUBTITLES] Signed URL error:', signedUrlError);
      throw new Error(`Failed to get video URL: ${signedUrlError?.message || 'No URL returned'}`);
    }

    console.log('[KYRGYZ-SUBTITLES] Sending signed URL to ElevenLabs ASR...');

    // Pass the signed URL directly to ElevenLabs using cloud_storage_url
    // This avoids memory constraints by not downloading the file
    const formData = new FormData();
    formData.append('model_id', 'scribe_v1');
    formData.append('language_code', 'ky'); // Kyrgyz language code
    formData.append('cloud_storage_url', signedUrlData.signedUrl);

    // Log FormData contents for debugging (especially mobile issues)
    console.log('[KYRGYZ-SUBTITLES] FormData fields:');
    for (const [key, value] of formData.entries()) {
      console.log(`  ${key}:`, typeof value === 'string' ? value.substring(0, 100) : value);
    }

    const response = await fetch(
      'https://api.elevenlabs.io/v1/speech-to-text',
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[KYRGYZ-SUBTITLES] ElevenLabs error:', response.status, errorText);
      throw new Error(`ElevenLabs API error: ${errorText}`);
    }

    const transcription = await response.json();
    console.log('[KYRGYZ-SUBTITLES] Transcription received');

    // Generate SRT subtitle file
    let srtContent = generateSRT(transcription);
    
    // Correct spelling if requested
    if (correctSpelling) {
      console.log('[KYRGYZ-SUBTITLES] Correcting spelling with Gemini...');
      try {
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        if (!LOVABLE_API_KEY) {
          console.error('[KYRGYZ-SUBTITLES] LOVABLE_API_KEY not found for spelling correction');
        } else {
          const geminiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${LOVABLE_API_KEY}`
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [{
                role: 'user',
                content: `You are a Kyrgyz language expert. Correct spelling mistakes in these Kyrgyz subtitles while preserving the exact SRT format.

CRITICAL RULES:
- Keep line numbers and timestamps EXACTLY as they are
- Only fix obvious spelling errors in Kyrgyz text
- Do NOT change the meaning or rephrase sentences
- Preserve all punctuation
- Return the complete SRT file with corrections

Subtitles to correct:
${srtContent}`
              }]
            })
          });
          
          if (geminiResponse.ok) {
            const geminiData = await geminiResponse.json();
            const correctedContent = geminiData.choices[0]?.message?.content;
            if (correctedContent) {
              srtContent = correctedContent;
              console.log('[KYRGYZ-SUBTITLES] Spelling corrected successfully');
            }
          } else {
            const errorText = await geminiResponse.text();
            console.error('[KYRGYZ-SUBTITLES] Failed to correct spelling:', geminiResponse.status, errorText);
          }
        }
      } catch (spellingError) {
        console.error('[KYRGYZ-SUBTITLES] Error correcting spelling:', spellingError);
        // Continue with original subtitles if spelling correction fails
      }
    }
    
    // Add emojis if requested
    if (addEmojis) {
      console.log('[KYRGYZ-SUBTITLES] Adding emojis to subtitles...');
      try {
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        if (!LOVABLE_API_KEY) {
          console.error('[KYRGYZ-SUBTITLES] LOVABLE_API_KEY not found');
          throw new Error('LOVABLE_API_KEY is not configured');
        }

        const geminiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LOVABLE_API_KEY}`
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{
              role: 'user',
              content: `Add relevant emojis to these subtitles. Keep the exact SRT format (including line numbers and timestamps). Only add 1-2 relevant emojis per subtitle line where appropriate. Keep the Kyrgyz text exactly as is.\n\nSubtitles:\n${srtContent}`
            }]
          })
        });
        
        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          const enhancedContent = geminiData.choices[0]?.message?.content;
          if (enhancedContent) {
            srtContent = enhancedContent;
            console.log('[KYRGYZ-SUBTITLES] Emojis added successfully');
          }
        } else {
          const errorText = await geminiResponse.text();
          console.error('[KYRGYZ-SUBTITLES] Failed to add emojis:', geminiResponse.status, errorText);
        }
      } catch (emojiError) {
        console.error('[KYRGYZ-SUBTITLES] Error adding emojis:', emojiError);
        // Continue with original subtitles if emoji addition fails
      }
    }

    // Save subtitle to database only for authenticated users
    if (userId) {
      const { error: insertError } = await supabaseClient
        .from('video_subtitles')
        .insert({
          user_id: userId,
          video_path: videoPath,
          subtitle_content: srtContent,
          language: 'ky'
        });

      if (insertError) {
        console.error('[KYRGYZ-SUBTITLES] Insert error:', insertError);
        // Don't throw - still return subtitles even if save fails
        console.warn('[KYRGYZ-SUBTITLES] Failed to save subtitles to database, but continuing');
      } else {
        console.log('[KYRGYZ-SUBTITLES] Subtitles saved successfully');
      }
    } else {
      console.log('[KYRGYZ-SUBTITLES] Guest user - skipping database save');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        subtitles: srtContent,
        transcription: transcription.text
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[KYRGYZ-SUBTITLES] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
