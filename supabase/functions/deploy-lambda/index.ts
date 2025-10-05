import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { 
  LambdaClient, 
  CreateFunctionCommand, 
  UpdateFunctionCodeCommand,
  GetFunctionCommand,
  ResourceNotFoundException 
} from "https://esm.sh/@aws-sdk/client-lambda@3.637.0";

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

    // Initialize AWS Lambda client
    const lambdaClient = new LambdaClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });

    // Convert code string to Uint8Array for Lambda
    const codeBuffer = new TextEncoder().encode(code);

    let result;
    let functionExists = false;

    // Check if function exists
    try {
      const getCommand = new GetFunctionCommand({ FunctionName: functionName });
      await lambdaClient.send(getCommand);
      functionExists = true;
      console.log(`[DEPLOY-LAMBDA] Function exists, will update code`);
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        console.log(`[DEPLOY-LAMBDA] Function does not exist, will create new function`);
      } else {
        throw error;
      }
    }

    if (functionExists) {
      // Update existing function
      const updateCommand = new UpdateFunctionCodeCommand({
        FunctionName: functionName,
        ZipFile: codeBuffer,
      });
      result = await lambdaClient.send(updateCommand);
      console.log(`[DEPLOY-LAMBDA] Function code updated successfully`);
    } else {
      // Create new function
      const createCommand = new CreateFunctionCommand({
        FunctionName: functionName,
        Runtime: runtime || 'nodejs20.x',
        Role: roleArn,
        Handler: handler || 'index.handler',
        Code: {
          ZipFile: codeBuffer,
        },
        Description: `Deployed via Lovable on ${new Date().toISOString()}`,
        Timeout: 30,
        MemorySize: 256,
      });
      result = await lambdaClient.send(createCommand);
      console.log(`[DEPLOY-LAMBDA] Function created successfully`);
    }

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
