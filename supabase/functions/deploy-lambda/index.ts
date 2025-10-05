import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const encoder = new TextEncoder();
  return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getSignatureKey(
  key: string,
  dateStamp: string,
  regionName: string,
  serviceName: string
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const kDate = await hmacSha256(encoder.encode('AWS4' + key).buffer, dateStamp);
  const kRegion = await hmacSha256(kDate, regionName);
  const kService = await hmacSha256(kRegion, serviceName);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  return kSigning;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { functionName, handler, runtime, code, roleArn, zipBase64, layers } = await req.json();

    const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID');
    const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY');
    let AWS_REGION = Deno.env.get('AWS_REGION') || 'us-east-1';
    
    // Fix common region format issues
    if (AWS_REGION === 'east-1') {
      AWS_REGION = 'us-east-1';
      console.log('[DEPLOY-LAMBDA] Fixed region format: us-east-1');
    }

    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials not configured');
    }

    console.log(`[DEPLOY-LAMBDA] Deploying function: ${functionName}`);
    console.log(`[DEPLOY-LAMBDA] Region: ${AWS_REGION}`);
    console.log(`[DEPLOY-LAMBDA] Runtime: ${runtime}`);
    console.log(`[DEPLOY-LAMBDA] Handler: ${handler}`);

    const service = 'lambda';
    const host = `${service}.${AWS_REGION}.amazonaws.com`;
    const endpoint = `https://${host}/2015-03-31/functions`;
    
    // Create timestamp
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    // Prepare base64-encoded ZIP for Lambda
    let base64Zip = '';
    const handlerFile = (handler?.split('.')?.[0] || 'index') + '.js';

    if (zipBase64 && typeof zipBase64 === 'string' && zipBase64.trim().length > 0) {
      base64Zip = zipBase64;
      console.log('[DEPLOY-LAMBDA] Using provided zipBase64');
    } else {
      if (!code || typeof code !== 'string' || code.trim().length === 0) {
        throw new Error('No code provided. Provide raw code or a prebuilt base64 ZIP (zipBase64).');
      }
      const zip = new JSZip();
      zip.file(handlerFile, code);
      const zipContent: Uint8Array = await zip.generateAsync({ type: 'uint8array' });
      base64Zip = btoa(String.fromCharCode(...zipContent));
      console.log(`[DEPLOY-LAMBDA] Generated ZIP with entry: ${handlerFile}, size=${zipContent.byteLength} bytes`);
    }

    // Check if function exists with proper AWS signature
    const getFunctionUrl = `${endpoint}/${functionName}`;
    
    let functionExists = false;
    try {
      // Create signature for GET request
      const getCanonicalUri = `/2015-03-31/functions/${functionName}`;
      const getCanonicalRequest = `GET\n${getCanonicalUri}\n\nhost:${host}\nx-amz-date:${amzDate}\n\nhost;x-amz-date\n${await sha256('')}`;
      const getStringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${dateStamp}/${AWS_REGION}/${service}/aws4_request\n${await sha256(getCanonicalRequest)}`;
      const getSigningKey = await getSignatureKey(AWS_SECRET_ACCESS_KEY, dateStamp, AWS_REGION, service);
      const getSignatureBuffer = await hmacSha256(getSigningKey, getStringToSign);
      const getSignature = Array.from(new Uint8Array(getSignatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      const getAuthHeader = `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY_ID}/${dateStamp}/${AWS_REGION}/${service}/aws4_request, SignedHeaders=host;x-amz-date, Signature=${getSignature}`;
      
      const getResponse = await fetch(getFunctionUrl, {
        method: 'GET',
        headers: {
          'Host': host,
          'X-Amz-Date': amzDate,
          'Authorization': getAuthHeader,
        },
      });
      functionExists = getResponse.status === 200;
      console.log(`[DEPLOY-LAMBDA] Function exists check: ${functionExists}`);
    } catch (e) {
      console.log('[DEPLOY-LAMBDA] Function check failed, will attempt create:', e);
    }

    // Prepare request
    const method = functionExists ? 'PUT' : 'POST';
    const url = functionExists ? `${endpoint}/${functionName}/code` : endpoint;
    
    // Parse layers if provided (comma or newline separated)
    let layersArray: string[] = [];
    if (layers && typeof layers === 'string' && layers.trim().length > 0) {
      layersArray = layers
        .split(/[\n,]+/)
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0);
      console.log(`[DEPLOY-LAMBDA] Layers to attach:`, layersArray);
    }

    const payload = functionExists 
      ? { ZipFile: base64Zip }
      : {
          FunctionName: functionName,
          Runtime: runtime || 'nodejs20.x',
          Role: roleArn,
          Handler: handler || 'index.handler',
          Code: { ZipFile: base64Zip },
          Description: `Deployed via Lovable on ${new Date().toISOString()}`,
          Timeout: 900,
          MemorySize: 2048,
          ...(layersArray.length > 0 && { Layers: layersArray }),
        };

    const payloadStr = JSON.stringify(payload);
    const payloadHash = await sha256(payloadStr);

    // Create canonical request
    const canonicalUri = functionExists ? `/2015-03-31/functions/${functionName}/code` : '/2015-03-31/functions';
    const canonicalQuerystring = '';
    const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-date';
    const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${AWS_REGION}/${service}/aws4_request`;
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;

    // Calculate signature
    const signingKey = await getSignatureKey(AWS_SECRET_ACCESS_KEY, dateStamp, AWS_REGION, service);
    const signatureBuffer = await hmacSha256(signingKey, stringToSign);
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Create authorization header
    const authorizationHeader = `${algorithm} Credential=${AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    console.log(`[DEPLOY-LAMBDA] Sending ${method} request to AWS Lambda`);

    // Make the request
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Host': host,
        'X-Amz-Date': amzDate,
        'Authorization': authorizationHeader,
      },
      body: payloadStr,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[DEPLOY-LAMBDA] Deployment failed:`, errorText);
      throw new Error(`Lambda deployment failed: ${errorText}`);
    }

    const result = await response.json();
    console.log(`[DEPLOY-LAMBDA] Deployment successful`);

    return new Response(
      JSON.stringify({
        success: true,
        functionName,
        arn: result.FunctionArn,
        status: result.State,
        message: functionExists ? 'Lambda function updated successfully' : 'Lambda function created successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[DEPLOY-LAMBDA] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
