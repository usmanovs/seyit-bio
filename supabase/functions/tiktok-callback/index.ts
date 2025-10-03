import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    if (!code) {
      throw new Error('No authorization code received');
    }

    const TIKTOK_CLIENT_KEY = Deno.env.get('TIKTOK_CLIENT_KEY');
    const TIKTOK_CLIENT_SECRET = Deno.env.get('TIKTOK_CLIENT_SECRET');
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/tiktok-callback`;

    // Exchange code for access token
    const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY!,
        client_secret: TIKTOK_CLIENT_SECRET!,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log('Token response:', tokenData);

    if (tokenData.error) {
      throw new Error(`TikTok OAuth error: ${tokenData.error_description || tokenData.error}`);
    }

    // Get user ID from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Store tokens in database
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    
    const { error: dbError } = await supabaseClient
      .from('tiktok_credentials')
      .upsert({
        user_id: user.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to store credentials');
    }

    // Redirect back to app with success
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${Deno.env.get('VITE_SUPABASE_URL')}?tiktok_auth=success`,
      },
    });
  } catch (error) {
    console.error('Error in tiktok-callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Redirect back to app with error
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${Deno.env.get('VITE_SUPABASE_URL')}?tiktok_auth=error&message=${encodeURIComponent(errorMessage)}`,
      },
    });
  }
});
