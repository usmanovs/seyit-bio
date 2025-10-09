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
            content: `You are an AI news assistant. Today is ${currentDate}. Provide exactly 3 important AI-related news items. Focus on artificial intelligence, machine learning, AI companies, AI research, and AI applications. Format your response as a JSON array with exactly 3 objects, each containing "title" (short headline) and "summary" (1-2 sentences). Be informative and focus on recent developments in AI.`
          },
          {
            role: 'user',
            content: 'Please provide the top 3 AI news items.'
          }
        ],
      }),
    });

    if (!response.ok) {
      const code = response.status;
      const errorText = await response.text();
      console.error('[GET-DAILY-NEWS] AI Gateway error:', code, errorText);
      const msg = code === 429
        ? 'Rate limit exceeded. Please try again later.'
        : code === 402
        ? 'Payment required. Please add credits to your workspace.'
        : `AI Gateway error: ${code}`;
      return new Response(
        JSON.stringify({ success: false, code, error: msg, details: errorText }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('[GET-DAILY-NEWS] Response received from Gemini');
    
    const newsContent = data.choices[0].message.content;
    console.log('[GET-DAILY-NEWS] Raw content:', newsContent);
    
    // Try to extract JSON from markdown code blocks or parse directly
    let newsItems;
    try {
      // Check if content is wrapped in markdown code blocks
      const jsonMatch = newsContent.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : newsContent;
      
      newsItems = JSON.parse(jsonString);
      console.log('[GET-DAILY-NEWS] Parsed news items:', JSON.stringify(newsItems));
      
      // Ensure it's an array
      if (!Array.isArray(newsItems)) {
        newsItems = [newsItems];
      }
    } catch (e) {
      console.log('[GET-DAILY-NEWS] Failed to parse JSON, creating fallback structure:', e);
      // If not JSON, create AI-focused fallback news items
      newsItems = [
        {
          title: "AI Models Continue Rapid Evolution",
          summary: "Latest developments in large language models show significant improvements in reasoning capabilities and multimodal understanding."
        },
        {
          title: "AI Integration in Business Accelerates",
          summary: "Companies across industries are adopting AI tools for automation, customer service, and data analysis at unprecedented rates."
        },
        {
          title: "AI Safety and Ethics Remain Priority",
          summary: "Researchers and policymakers continue working on frameworks to ensure responsible AI development and deployment."
        }
      ];
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
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
