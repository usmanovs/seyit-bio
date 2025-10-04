import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ErrorNotificationRequest {
  errorType: string;
  errorMessage: string;
  errorStack?: string;
  userEmail?: string;
  userId?: string;
  deviceType?: string;
  fileName?: string;
  fileSize?: number;
  filePath?: string;
  additionalContext?: Record<string, any>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      errorType,
      errorMessage,
      errorStack,
      userEmail,
      userId,
      deviceType,
      fileName,
      fileSize,
      filePath,
      additionalContext,
    }: ErrorNotificationRequest = await req.json();

    console.log("[ERROR-NOTIFICATION] Sending error notification:", {
      errorType,
      errorMessage,
    });

    // Format file size for readability
    const formatFileSize = (bytes?: number) => {
      if (!bytes) return "N/A";
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    // Build HTML email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
            .section { margin-bottom: 20px; }
            .label { font-weight: bold; color: #374151; }
            .value { background: white; padding: 10px; border-radius: 4px; margin-top: 5px; }
            .code { background: #1f2937; color: #10b981; padding: 15px; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 12px; }
            .timestamp { color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🚨 Video Processing Error</h1>
              <p style="margin: 5px 0 0 0;">${errorType}</p>
            </div>
            <div class="content">
              <div class="section">
                <div class="label">Error Message:</div>
                <div class="value">${errorMessage}</div>
              </div>

              ${errorStack ? `
              <div class="section">
                <div class="label">Stack Trace:</div>
                <div class="code">${errorStack.replace(/\n/g, '<br>')}</div>
              </div>
              ` : ''}

              ${userEmail || userId ? `
              <div class="section">
                <div class="label">User Information:</div>
                <div class="value">
                  ${userEmail ? `Email: ${userEmail}<br>` : ''}
                  ${userId ? `User ID: ${userId}` : ''}
                </div>
              </div>
              ` : ''}

              ${deviceType || fileName || fileSize || filePath ? `
              <div class="section">
                <div class="label">Context:</div>
                <div class="value">
                  ${deviceType ? `Device: ${deviceType}<br>` : ''}
                  ${fileName ? `File Name: ${fileName}<br>` : ''}
                  ${fileSize ? `File Size: ${formatFileSize(fileSize)}<br>` : ''}
                  ${filePath ? `File Path: ${filePath}` : ''}
                </div>
              </div>
              ` : ''}

              ${additionalContext && Object.keys(additionalContext).length > 0 ? `
              <div class="section">
                <div class="label">Additional Details:</div>
                <div class="value">
                  <pre style="margin: 0; white-space: pre-wrap;">${JSON.stringify(additionalContext, null, 2)}</pre>
                </div>
              </div>
              ` : ''}

              <div class="timestamp">
                Timestamp: ${new Date().toISOString()}
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Gaptions Errors <onboarding@resend.dev>",
      to: ["usmanov.seyitbek@gmail.com"],
      subject: `🚨 Video Processing Error - ${errorType}`,
      html: htmlContent,
    });

    console.log("[ERROR-NOTIFICATION] Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("[ERROR-NOTIFICATION] Error sending notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
