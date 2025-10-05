import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { requestId, videoPath, subtitles, styleId = 'outline' } = await req.json();
    
    console.log(`[${requestId}] Lambda burn request - video: ${videoPath}, style: ${styleId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get public URL for video
    const { data: { publicUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(videoPath);

    console.log(`[${requestId}] Video URL: ${publicUrl}`);

    // Format subtitles to clean SRT
    const cleanedSrt = subtitles
      .split('\n\n')
      .filter((block: string) => block.trim())
      .map((block: string, index: number) => {
        const lines = block.trim().split('\n');
        if (lines.length < 2) return null;
        
        const timeLine = lines.find((l: string) => l.includes('-->'));
        const textLines = lines.filter((l: string) => !l.match(/^\d+$/) && !l.includes('-->'));
        
        if (!timeLine || textLines.length === 0) return null;
        
        return `${index + 1}\n${timeLine}\n${textLines.join('\n')}`;
      })
      .filter(Boolean)
      .join('\n\n');

    // Upload SRT to storage
    const srtFileName = `${requestId}.srt`;
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(srtFileName, new Blob([cleanedSrt]), {
        contentType: 'text/plain',
        upsert: true,
      });

    if (uploadError) {
      console.error(`[${requestId}] SRT upload failed:`, uploadError);
      throw uploadError;
    }

    const { data: { publicUrl: srtUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(srtFileName);

    console.log(`[${requestId}] SRT uploaded: ${srtUrl}`);

    // Style mappings - using ONLY Symbola (no comma-separated fallbacks)
    const styleMapping: Record<string, any> = {
      outline: {
        FontName: 'Symbola',
        FontSize: 24,
        PrimaryColour: '&H00FFFFFF',
        OutlineColour: '&H00000000',
        BackColour: '&H80000000',
        Bold: -1,
        Outline: 2,
        Shadow: 0,
        Alignment: 2,
        MarginV: 20,
        BorderStyle: 1,
      },
      minimal: {
        FontName: 'Symbola',
        FontSize: 20,
        PrimaryColour: '&H00FFFFFF',
        OutlineColour: '&H00000000',
        BackColour: '&H00000000',
        Bold: 0,
        Outline: 1,
        Shadow: 1,
        Alignment: 2,
        MarginV: 15,
        BorderStyle: 1,
      },
      green: {
        FontName: 'Symbola',
        FontSize: 26,
        PrimaryColour: '&H0000FF00',
        OutlineColour: '&H00000000',
        BackColour: '&H80000000',
        Bold: -1,
        Outline: 3,
        Shadow: 0,
        Alignment: 2,
        MarginV: 25,
        BorderStyle: 1,
      },
      boxed: {
        FontName: 'Symbola',
        FontSize: 22,
        PrimaryColour: '&H00FFFFFF',
        OutlineColour: '&H00000000',
        BackColour: '&H80000000',
        Bold: -1,
        Outline: 0,
        Shadow: 0,
        Alignment: 2,
        MarginV: 20,
        BorderStyle: 4,
      },
    };

    const style = styleMapping[styleId] || styleMapping.outline;
    
    const forceStyleParams = Object.entries(style)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');

    console.log(`[${requestId}] Style parameters:`, forceStyleParams);

    // Invoke Lambda function with AWS SigV4 signing
    const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID')!;
    const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY')!;
    const AWS_REGION = Deno.env.get('AWS_REGION') || 'us-east-1';
    const LAMBDA_FUNCTION_NAME = 'subtitle-burner';

    const payload = {
      videoUrl: publicUrl,
      srtUrl: srtUrl,
      forceStyle: forceStyleParams,
      requestId: requestId,
      supabaseUrl: supabaseUrl,
      supabaseKey: supabaseKey,
    };

    console.log(`[${requestId}] Invoking Lambda: ${LAMBDA_FUNCTION_NAME}`);

    // Create AWS SigV4 signature for Lambda invocation
    const payloadString = JSON.stringify(payload);
    const payloadHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payloadString));
    const payloadHashHex = Array.from(new Uint8Array(payloadHash)).map(b => b.toString(16).padStart(2, '0')).join('');

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    
    const service = 'lambda';
    const host = `lambda.${AWS_REGION}.amazonaws.com`;
    const canonicalUri = `/2015-03-31/functions/${LAMBDA_FUNCTION_NAME}/invocations`;
    const canonicalQueryString = '';
    const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-date';
    
    const canonicalRequest = `POST\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHashHex}`;
    
    const credentialScope = `${dateStamp}/${AWS_REGION}/${service}/aws4_request`;
    const canonicalRequestHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest));
    const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHashHex}`;
    
    // Generate signing key
    const getSignatureKey = async (key: string, dateStamp: string, regionName: string, serviceName: string) => {
      const kDate = await crypto.subtle.importKey('raw', new TextEncoder().encode(`AWS4${key}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const kDateSig = await crypto.subtle.sign('HMAC', kDate, new TextEncoder().encode(dateStamp));
      
      const kRegion = await crypto.subtle.importKey('raw', kDateSig, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const kRegionSig = await crypto.subtle.sign('HMAC', kRegion, new TextEncoder().encode(regionName));
      
      const kService = await crypto.subtle.importKey('raw', kRegionSig, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const kServiceSig = await crypto.subtle.sign('HMAC', kService, new TextEncoder().encode(serviceName));
      
      const kSigning = await crypto.subtle.importKey('raw', kServiceSig, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      return kSigning;
    };
    
    const signingKey = await getSignatureKey(AWS_SECRET_ACCESS_KEY, dateStamp, AWS_REGION, service);
    const signatureBuffer = await crypto.subtle.sign('HMAC', signingKey, new TextEncoder().encode(stringToSign));
    const signature = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
    const lambdaUrl = `https://${host}${canonicalUri}`;
    console.log(`[${requestId}] Lambda URL: ${lambdaUrl}`);
    
    const response = await fetch(lambdaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Amz-Date': amzDate,
        'X-Amz-Invocation-Type': 'RequestResponse',
        'Authorization': authorizationHeader,
        'Host': host,
      },
      body: payloadString,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${requestId}] Lambda invocation failed:`, errorText);
      throw new Error(`Lambda invocation failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log(`[${requestId}] Lambda response:`, result);

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: result.videoUrl,
        message: 'Video processed successfully with Lambda',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in burn-subtitles-lambda:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: errorDetails,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
