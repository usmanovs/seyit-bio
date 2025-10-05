import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHash, createHmac } from "https://deno.land/std@0.160.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function hmac(key: Uint8Array | string, message: string): Uint8Array {
  const hmacInstance = createHmac('sha256', key);
  hmacInstance.update(message);
  return new Uint8Array(hmacInstance.digest());
}

function sha256(message: string): string {
  const hash = createHash('sha256');
  hash.update(message);
  return hash.digest('hex');
}

function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Uint8Array {
  const kDate = hmac('AWS4' + key, dateStamp);
  const kRegion = hmac(kDate, regionName);
  const kService = hmac(kRegion, serviceName);
  const kSigning = hmac(kService, 'aws4_request');
  return kSigning;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { functionName, handler, runtime, code, roleArn } = await req.json();

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

    // Encode code to base64
    const encoder = new TextEncoder();
    const codeBytes = encoder.encode(code);
    const base64Code = btoa(String.fromCharCode(...codeBytes));

    // Check if function exists
    const getFunctionUrl = `${endpoint}/${functionName}`;
    
    let functionExists = false;
    try {
      const getResponse = await fetch(getFunctionUrl, {
        method: 'GET',
        headers: {
          'Host': host,
          'X-Amz-Date': amzDate,
        },
      });
      functionExists = getResponse.status === 200;
    } catch (e) {
      console.log('[DEPLOY-LAMBDA] Function check failed, will attempt create');
    }

    // Prepare request
    const method = functionExists ? 'PUT' : 'POST';
    const url = functionExists ? `${endpoint}/${functionName}/code` : endpoint;
    
    const payload = functionExists 
      ? { ZipFile: base64Code }
      : {
          FunctionName: functionName,
          Runtime: runtime || 'nodejs20.x',
          Role: roleArn,
          Handler: handler || 'index.handler',
          Code: { ZipFile: base64Code },
          Description: `Deployed via Lovable on ${new Date().toISOString()}`,
          Timeout: 30,
          MemorySize: 256,
        };

    const payloadStr = JSON.stringify(payload);
    const payloadHash = sha256(payloadStr);

    // Create canonical request
    const canonicalUri = functionExists ? `/2015-03-31/functions/${functionName}/code` : '/2015-03-31/functions';
    const canonicalQuerystring = '';
    const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-date';
    const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${AWS_REGION}/${service}/aws4_request`;
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${sha256(canonicalRequest)}`;

    // Calculate signature
    const signingKey = getSignatureKey(AWS_SECRET_ACCESS_KEY, dateStamp, AWS_REGION, service);
    const signature = Array.from(hmac(signingKey, stringToSign))
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
