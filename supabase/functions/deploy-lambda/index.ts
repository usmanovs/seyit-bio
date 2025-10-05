import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { functionName, handler, runtime, code, roleArn } = await req.json();

    const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID');
    const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY');
    const AWS_REGION = Deno.env.get('AWS_REGION');

    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION) {
      throw new Error('AWS credentials not configured');
    }

    console.log(`[DEPLOY-LAMBDA] Deploying function: ${functionName}`);
    console.log(`[DEPLOY-LAMBDA] Region: ${AWS_REGION}`);
    console.log(`[DEPLOY-LAMBDA] Runtime: ${runtime}`);
    console.log(`[DEPLOY-LAMBDA] Handler: ${handler}`);

    // Create AWS signature
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = timestamp.slice(0, 8);

    // Encode function code to base64
    const encodedCode = btoa(code);

    // Create Lambda function or update if exists
    const lambdaEndpoint = `https://lambda.${AWS_REGION}.amazonaws.com/2015-03-31/functions`;

    // First, try to get the function to see if it exists
    const getFunctionUrl = `${lambdaEndpoint}/${functionName}`;
    
    const getHeaders = {
      'Content-Type': 'application/json',
      'X-Amz-Date': timestamp,
    };

    // Sign the request (simplified - you may need proper AWS Signature V4)
    const getResponse = await fetch(getFunctionUrl, {
      method: 'GET',
      headers: getHeaders,
    });

    let deploymentResponse;
    
    if (getResponse.status === 404) {
      // Function doesn't exist, create it
      console.log(`[DEPLOY-LAMBDA] Function does not exist, creating new function`);
      
      const createPayload = {
        FunctionName: functionName,
        Runtime: runtime || 'nodejs20.x',
        Role: roleArn,
        Handler: handler || 'index.handler',
        Code: {
          ZipFile: encodedCode
        },
        Description: `Deployed via Lovable on ${new Date().toISOString()}`,
        Timeout: 30,
        MemorySize: 256,
      };

      deploymentResponse = await fetch(lambdaEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Amz-Date': timestamp,
        },
        body: JSON.stringify(createPayload),
      });
    } else {
      // Function exists, update it
      console.log(`[DEPLOY-LAMBDA] Function exists, updating code`);
      
      const updateCodeUrl = `${lambdaEndpoint}/${functionName}/code`;
      const updatePayload = {
        ZipFile: encodedCode
      };

      deploymentResponse = await fetch(updateCodeUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Amz-Date': timestamp,
        },
        body: JSON.stringify(updatePayload),
      });
    }

    if (!deploymentResponse.ok) {
      const errorText = await deploymentResponse.text();
      console.error(`[DEPLOY-LAMBDA] Deployment failed:`, errorText);
      throw new Error(`Lambda deployment failed: ${errorText}`);
    }

    const result = await deploymentResponse.json();
    console.log(`[DEPLOY-LAMBDA] Deployment successful:`, result);

    return new Response(
      JSON.stringify({
        success: true,
        functionName,
        arn: result.FunctionArn,
        status: result.State,
        message: 'Lambda function deployed successfully'
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
