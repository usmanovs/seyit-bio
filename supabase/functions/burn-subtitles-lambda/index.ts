import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper functions for AWS signature
const sha256 = async (message: string): Promise<string> => {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

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


def normalize_srt(path):
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            txt = f.read()
        # Normalize newlines and remove BOM
        txt = txt.lstrip('\ufeff').replace('\r\n', '\n').replace('\r', '\n')
        # Ensure blank lines between cues
        parts = [p.strip() for p in txt.split('\n\n') if p.strip()]
        txt = '\n\n'.join(parts) + '\n'
        # Log preview
        preview = '\n'.join(txt.splitlines()[:6])
        print('SRT preview (first lines):\n' + preview)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(txt)
        has_arrow = '-->' in txt
        print(f'SRT validation: {'OK' if has_arrow else 'MISSING TIMELINES'}')
    except Exception as e:
        print(f'Failed to normalize SRT: {e}')


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

    # Normalize SRT for safety
    normalize_srt(srt_path)
    
    # Prepare fonts directory and download DejaVu Sans
    fonts_dir = '/tmp/fonts'
    os.makedirs(fonts_dir, exist_ok=True)
    try:
        font_url = 'https://github.com/dejavu-fonts/dejavu-fonts/raw/version_2_37/ttf/DejaVuSans.ttf'
        font_dest = os.path.join(fonts_dir, 'DejaVuSans.ttf')
        print(f'Downloading font from {font_url}')
        urllib.request.urlretrieve(font_url, font_dest)
    except Exception as e:
        print(f'Font download failed: {e}')
        pass
    
    # Ensure ffmpeg path is available
    os.environ['PATH'] = '/opt/bin:' + os.environ.get('PATH', '')
    ffmpeg_path = '/opt/bin/ffmpeg' if os.path.exists('/opt/bin/ffmpeg') else 'ffmpeg'

    # Escape style for filter (spaces in font name)
    force_style_escaped = force_style.replace('DejaVu Sans', 'DejaVu\\ Sans')

    # Build filter expressions
    filter_expr = f"subtitles={srt_path}:charenc=UTF-8:fontsdir={fonts_dir}:force_style={force_style_escaped}"
    fallback_filter_expr = f"subtitles={srt_path}:charenc=UTF-8:fontsdir={fonts_dir}"

    # Primary attempt with styling
    cmd = [
        ffmpeg_path,
        '-y',
        '-i', video_path,
        '-vf', filter_expr,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-crf', '18',
        '-preset', 'slow',
        '-c:a', 'copy',
        '-movflags', '+faststart',
        output_path
    ]

    print('Running FFmpeg (primary):', ' '.join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    print('FFmpeg stdout (primary):', result.stdout[-1000:])
    print('FFmpeg stderr (primary):', result.stderr[-2000:])

    if result.returncode != 0:
        print('Primary burn failed, attempting minimal fallback...')
        # Remove existing partial output if any
        try:
            if os.path.exists(output_path):
                os.remove(output_path)
        except Exception as e:
            print(f'Failed to remove partial output: {e}')
        # Fallback attempt without force_style
        fallback_cmd = [
            ffmpeg_path,
            '-y',
            '-i', video_path,
            '-vf', fallback_filter_expr,
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-crf', '18',
            '-preset', 'slow',
            '-c:a', 'copy',
            '-movflags', '+faststart',
            output_path
        ]
        print('Running FFmpeg (fallback):', ' '.join(fallback_cmd))
        fb = subprocess.run(fallback_cmd, capture_output=True, text=True)
        print('FFmpeg stdout (fallback):', fb.stdout[-1000:])
        print('FFmpeg stderr (fallback):', fb.stderr[-2000:])
        if fb.returncode != 0:
            raise Exception(f'FFmpeg failed (fallback): {fb.stderr}')

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

    const ffmpegLayerArn = Deno.env.get('AWS_FFMPEG_LAYER_ARN');
    if (!ffmpegLayerArn) {
      throw new Error('AWS_FFMPEG_LAYER_ARN not configured');
    }

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
        layers: ffmpegLayerArn,
      }),
    });

    if (!deployResponse.ok) {
      const deployError = await deployResponse.text();
      console.error(`[${requestId}] Auto-deployment failed:`, deployError);
      // Continue anyway - function might already exist with correct code
    } else {
      console.log(`[${requestId}] Lambda auto-deployment successful, waiting for function to become active...`);
      
      // Wait for Lambda function to become active (AWS needs time to propagate updates)
      const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID')!;
      const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY')!;
      const AWS_REGION = Deno.env.get('AWS_REGION') || 'us-east-1';
      
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check function state using AWS API
        const now = new Date();
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
        const dateStamp = amzDate.slice(0, 8);
        const host = `lambda.${AWS_REGION}.amazonaws.com`;
        const canonicalUri = `/2015-03-31/functions/subtitle-burner`;
        
        const emptyHash = await sha256('');
        const canonicalRequest = `GET\n${canonicalUri}\n\nhost:${host}\nx-amz-date:${amzDate}\n\nhost;x-amz-date\n${emptyHash}`;
        const canonicalRequestHash = await sha256(canonicalRequest);
        const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${dateStamp}/${AWS_REGION}/lambda/aws4_request\n${canonicalRequestHash}`;
        
        const signingKey = await getSignatureKey(AWS_SECRET_ACCESS_KEY, dateStamp, AWS_REGION, 'lambda');
        const signatureBuffer = await hmacSha256(signingKey, stringToSign);
        const signature = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        const authHeader = `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY_ID}/${dateStamp}/${AWS_REGION}/lambda/aws4_request, SignedHeaders=host;x-amz-date, Signature=${signature}`;
        
        try {
          const stateResponse = await fetch(`https://${host}${canonicalUri}`, {
            headers: {
              'Host': host,
              'X-Amz-Date': amzDate,
              'Authorization': authHeader,
            },
          });
          
          if (stateResponse.ok) {
            const stateData = await stateResponse.json();
            const cfg = stateData.Configuration || stateData;
            const state = cfg?.State;
            const update = cfg?.LastUpdateStatus;
            if (state === 'Active' && (update === 'Successful' || update === 'Idle')) {
              console.log(`[${requestId}] Lambda function is active and ready`);
              break;
            }
            console.log(`[${requestId}] Lambda state: ${state}, update status: ${update}`);
          }
        } catch (e) {
          console.warn(`[${requestId}] State check failed:`, e);
        }
      }
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

    // Style mappings - using DejaVu Sans (standard Linux font)
    const styleMapping: Record<string, any> = {
      outline: {
        FontName: 'DejaVu Sans',
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
        FontName: 'DejaVu Sans',
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
        FontName: 'DejaVu Sans',
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
        FontName: 'DejaVu Sans',
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
    
    // Build force_style string including FontName for proper subtitle rendering
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
      forceStyle: `${forceStyleParams}`,
      requestId: requestId,
      supabaseUrl: supabaseUrl,
      supabaseKey: supabaseKey,
    };

    console.log(`[${requestId}] Invoking Lambda: ${LAMBDA_FUNCTION_NAME}`);

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
        'X-Amz-Invocation-Type': 'Event',
        'Authorization': authorizationHeader,
        'Host': host,
      },
      body: payloadString,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${requestId}] Lambda invocation failed:`, errorText);
      return new Response(JSON.stringify({ success: false, error: `Lambda invocation failed: ${response.status}`, details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return immediately and let Lambda process asynchronously; frontend will poll the result URL
    const predictedUrl = `${supabaseUrl}/storage/v1/object/public/videos/${requestId}_burned.mp4`;
    return new Response(JSON.stringify({ success: true, processing: true, videoUrl: predictedUrl, requestId }), {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

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
