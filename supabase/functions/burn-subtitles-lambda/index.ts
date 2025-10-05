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

    // Auto-deploy Lambda function with latest code before processing
    console.log(`[${requestId}] Auto-deploying Lambda function with latest code...`);
    const lambdaCode = `import json
import subprocess
import os
import urllib.request

# Download monochrome emoji fonts at initialization (libass doesn't support color emoji fonts)
SYMBOLA_PATH = '/tmp/fonts/Symbola.ttf'
NOTO_EMOJI_PATH = '/tmp/fonts/NotoEmoji-Regular.ttf'

os.makedirs('/tmp/fonts', exist_ok=True)

if not os.path.exists(SYMBOLA_PATH):
    print('Downloading Symbola.ttf...')
    urllib.request.urlretrieve(
        'https://github.com/stphnwlsh/Symbola-Emoji-Font/raw/master/Symbola.ttf',
        SYMBOLA_PATH
    )
    print(f'Symbola font downloaded to {SYMBOLA_PATH}')

if not os.path.exists(NOTO_EMOJI_PATH):
    print('Downloading NotoEmoji-Regular.ttf (monochrome)...')
    # Using monochrome version because libass (FFmpeg subtitle renderer) doesn't support color fonts
    urllib.request.urlretrieve(
        'https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoEmoji-VariableFont_wght.ttf',
        NOTO_EMOJI_PATH
    )
    print(f'Noto Emoji font downloaded to {NOTO_EMOJI_PATH}')

# Create fontconfig to help FFmpeg find and prioritize emoji fonts
FONTCONFIG = '/tmp/fonts.conf'
with open(FONTCONFIG, 'w') as f:
    f.write("""<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/tmp/fonts</dir>
  <cachedir>/tmp</cachedir>
  <alias>
    <family>sans-serif</family>
    <prefer>
      <family>Noto Emoji</family>
      <family>Symbola</family>
    </prefer>
  </alias>
  <alias>
    <family>Symbola</family>
    <prefer>
      <family>Noto Emoji</family>
      <family>Symbola</family>
    </prefer>
  </alias>
</fontconfig>""")
print(f'Fontconfig created at {FONTCONFIG}')

def handler(event, context):
    video_url = event['videoUrl']
    srt_url = event['srtUrl']
    force_style = event['forceStyle']
    request_id = event['requestId']
    supabase_url = event['supabaseUrl']
    supabase_key = event['supabaseKey']
    
    # Download files
    video_path = '/tmp/input.mp4'
    srt_path = '/tmp/subtitles.srt'
    output_path = '/tmp/output.mp4'
    
    print(f'Downloading video from {video_url}')
    urllib.request.urlretrieve(video_url, video_path)
    
    print(f'Downloading SRT from {srt_url}')
    urllib.request.urlretrieve(srt_url, srt_path)
    
    # Set fontconfig environment
    env = os.environ.copy()
    env['FONTCONFIG_FILE'] = FONTCONFIG
    env['FONTCONFIG_PATH'] = '/tmp'
    
    # Burn subtitles with FFmpeg using provided force_style (already includes FontName fallback)
    cmd = [
        'ffmpeg',
        '-i', video_path,
        '-vf', f"subtitles={srt_path}:fontsdir=/tmp/fonts:force_style='{force_style}'",
        '-c:v', 'libx264',
        '-crf', '18',
        '-preset', 'slow',
        '-c:a', 'copy',
        '-movflags', '+faststart',
        output_path
    ]
    
    print(f'Running FFmpeg: {" ".join(cmd)}')
    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    
    if result.returncode != 0:
        print(f'FFmpeg stderr: {result.stderr}')
        raise Exception(f'FFmpeg failed: {result.stderr}')
    
    print('Video processing complete')
    
    # Upload result to Supabase Storage
    with open(output_path, 'rb') as f:
        video_data = f.read()
    
    output_filename = f'{request_id}_burned.mp4'
    
    # Use Supabase REST API to upload
    upload_url = f'{supabase_url}/storage/v1/object/videos/{output_filename}'
    req = urllib.request.Request(
        upload_url,
        data=video_data,
        headers={
            'Authorization': f'Bearer {supabase_key}',
            'Content-Type': 'video/mp4'
        },
        method='POST'
    )
    
    print(f'Uploading to {upload_url}')
    urllib.request.urlopen(req)
    
    result_url = f'{supabase_url}/storage/v1/object/public/videos/{output_filename}'
    
    print(f'Upload complete: {result_url}')
    
    return {
        'statusCode': 200,
        'body': json.dumps({'videoUrl': result_url})
    }`;

    const deployResponse = await fetch(`${supabaseUrl}/functions/v1/deploy-lambda`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        functionName: 'subtitle-burner',
        handler: 'index.handler',
        runtime: 'python3.12',
        code: lambdaCode,
        roleArn: Deno.env.get('AWS_LAMBDA_ROLE_ARN') || 'arn:aws:iam::733002311493:role/lambda-ex',
        layers: 'arn:aws:lambda:us-east-1:145266761615:layer:ffmpeg:4',
      }),
    });

    if (!deployResponse.ok) {
      const deployError = await deployResponse.text();
      console.error(`[${requestId}] Auto-deployment failed:`, deployError);
      // Continue anyway - function might already exist with correct code
    } else {
      console.log(`[${requestId}] Lambda auto-deployment successful`);
    }

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
    
    // Build force_style string but exclude FontName (we set it explicitly in Lambda to enable emoji fallbacks)
    const forceStyleParams = Object.entries(style)
      .filter(([key]) => key !== 'FontName')
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
      forceStyle: `FontName=Noto Emoji,Symbola,${forceStyleParams}`,
      requestId: requestId,
      supabaseUrl: supabaseUrl,
      supabaseKey: supabaseKey,
    };

    console.log(`[${requestId}] Invoking Lambda: ${LAMBDA_FUNCTION_NAME}`);

    // Helper function for HMAC-SHA256
    const hmacSha256 = async (key: ArrayBuffer, message: string): Promise<ArrayBuffer> => {
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
    };

    // Helper function for SHA-256
    const sha256 = async (message: string): Promise<string> => {
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    };

    // Generate AWS SigV4 signing key
    const getSignatureKey = async (
      key: string,
      dateStamp: string,
      regionName: string,
      serviceName: string
    ): Promise<ArrayBuffer> => {
      const kDate = await hmacSha256(
        new TextEncoder().encode(`AWS4${key}`).buffer,
        dateStamp
      );
      const kRegion = await hmacSha256(kDate, regionName);
      const kService = await hmacSha256(kRegion, serviceName);
      const kSigning = await hmacSha256(kService, 'aws4_request');
      return kSigning;
    };

    // Create AWS SigV4 signature for Lambda invocation
    const payloadString = JSON.stringify(payload);
    const payloadHashHex = await sha256(payloadString);

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
    const canonicalRequestHashHex = await sha256(canonicalRequest);
    
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHashHex}`;
    
    const signingKey = await getSignatureKey(AWS_SECRET_ACCESS_KEY, dateStamp, AWS_REGION, service);
    const signatureBuffer = await hmacSha256(signingKey, stringToSign);
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
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
