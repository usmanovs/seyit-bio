import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[GET-DAILY-NEWS] Function started');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('[GET-DAILY-NEWS] Calling Lovable AI Gateway with Gemini');
    
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
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
            content: `You are a news briefing assistant. Today is ${currentDate}. Provide a brief, professional news summary with 3-5 important topics. Format your response as a JSON array of news items, each with a "title" and "summary" (1-2 sentences). Focus on business, technology, and world events. Be factual and concise.`
          },
          {
            role: 'user',
            content: 'Please provide today\'s top news headlines and brief summaries.'
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GET-DAILY-NEWS] AI Gateway error:', response.status, errorText);
      
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
      
      throw new Error(`AI Gateway error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('[GET-DAILY-NEWS] Response received from Gemini');
    
    const newsContent = data.choices[0].message.content;
    
    // Try to parse as JSON, fallback to plain text
    let newsItems;
    try {
      newsItems = JSON.parse(newsContent);
    } catch {
      // If not JSON, create a simple structure
      newsItems = [{
        title: "Daily News Brief",
        summary: newsContent
      }];
    }

    return new Response(
      JSON.stringify({ 
        news: newsItems,
        generatedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[GET-DAILY-NEWS] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
