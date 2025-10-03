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

    console.log('[VIDEO-SUMMARY] Generating summaries for transcription');

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
            content: 'You are a creative copywriter specializing in viral social media content. Generate detailed, engaging summaries in Kyrgyz language (3-5 sentences each) that capture the key points and hook viewers. Use emojis strategically and make it compelling. Include specific details from the content to make it informative yet catchy.'
          },
          {
            role: 'user',
            content: `Based on this video transcription, generate 2 detailed, catchy summaries in Kyrgyz language. Each summary should be 3-5 sentences long and include key details from the video:\n\n${transcription}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'generate_summaries',
              description: 'Generate 2 catchy, clickbaity video summaries in Kyrgyz',
              parameters: {
                type: 'object',
                properties: {
                  summaries: {
                    type: 'array',
                    items: {
                      type: 'string'
                    },
                    minItems: 2,
                    maxItems: 2
                  }
                },
                required: ['summaries'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'generate_summaries' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('[VIDEO-SUMMARY] AI gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    console.log('[VIDEO-SUMMARY] Response:', JSON.stringify(data));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in response');
    }

    const summaries = JSON.parse(toolCall.function.arguments).summaries;

    return new Response(
      JSON.stringify({ success: true, summaries }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[VIDEO-SUMMARY] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
