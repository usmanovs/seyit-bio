import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { transcription } = await req.json();

    if (!transcription) {
      throw new Error('Transcription is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('[TITLE-VARIATIONS] Generating title variations for transcription');

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
            content: 'You are a creative video title generator. Generate 5 engaging, catchy video titles based on the video transcription. Titles should be in Kyrgyz language, attention-grabbing, and suitable for social media. Each title should be unique and capture the essence of the video content.'
          },
          {
            role: 'user',
            content: `Based on this video transcription, generate 5 creative title variations:\n\n${transcription}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'generate_titles',
              description: 'Generate 5 creative video title variations',
              parameters: {
                type: 'object',
                properties: {
                  titles: {
                    type: 'array',
                    items: {
                      type: 'string'
                    },
                    minItems: 5,
                    maxItems: 5
                  }
                },
                required: ['titles'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'generate_titles' } }
      }),
    });

    if (!response.ok) {
      const code = response.status;
      const errorText = await response.text();
      console.error('[TITLE-VARIATIONS] AI gateway error:', code, errorText);
      const msg = code === 429
        ? 'Rate limit exceeded. Please try again later.'
        : code === 402
        ? 'Payment required. Please add credits to your workspace.'
        : 'AI gateway error';
      return new Response(
        JSON.stringify({ success: false, code, error: msg, details: errorText }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('[TITLE-VARIATIONS] Response:', JSON.stringify(data));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in response');
    }

    const titles = JSON.parse(toolCall.function.arguments).titles;

    return new Response(
      JSON.stringify({ success: true, titles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[TITLE-VARIATIONS] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
