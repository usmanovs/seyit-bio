import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subtitles, addEmojis, correctSpelling, requestId, language } = await req.json();
    
    console.log(`[${requestId}] Applying modifications to existing subtitles`, {
      addEmojis,
      correctSpelling,
      subtitleLength: subtitles?.length,
      language
    });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Determine language name from code
    const languageNameMap: Record<string, string> = {
      ky: 'Kyrgyz', kk: 'Kazakh', uz: 'Uzbek', ru: 'Russian', tr: 'Turkish',
      en: 'English', ar: 'Arabic', zh: 'Chinese', es: 'Spanish', fr: 'French',
      de: 'German', hi: 'Hindi', ja: 'Japanese', ko: 'Korean'
    };
    const languageName = languageNameMap[language] ?? 'Kyrgyz';

    // Build the modification prompt
    let prompt = `You are modifying existing ${languageName} subtitles.` + ' ';
    
    if (correctSpelling && addEmojis) {
      prompt += 'Apply both spelling corrections AND add relevant emojis to the subtitles. ';
    } else if (correctSpelling) {
      prompt += 'Only correct any spelling mistakes in the subtitles. ';
    } else if (addEmojis) {
      prompt += 'Only add relevant emojis to the subtitles. ';
    }
    
    prompt += `Keep the timing information (timestamps) EXACTLY as they are. Only modify the text content.

Important: Do NOT change the language. Keep all text in ${languageName}.

Here are the subtitles in SRT format:

${subtitles}

Return ONLY the modified subtitles in the exact same SRT format with the same timestamps. Do not add any explanation or commentary.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a subtitle modification assistant. You modify subtitle text while preserving timing information exactly.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${requestId}] AI gateway error:`, response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const modifiedSubtitles = data.choices?.[0]?.message?.content?.trim();

    if (!modifiedSubtitles) {
      throw new Error('No subtitles received from AI');
    }

    console.log(`[${requestId}] Successfully modified subtitles`);

    return new Response(
      JSON.stringify({ subtitles: modifiedSubtitles }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
