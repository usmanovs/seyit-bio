import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";

const LambdaDeploy = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ success: boolean; message: string; arn?: string } | null>(null);

  const [formData, setFormData] = useState({
    functionName: "",
    runtime: "nodejs20.x",
    handler: "index.handler",
    roleArn: "",
    code: `exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello from Lambda!' })
  };
};`
  });

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.functionName || !formData.roleArn || !formData.code) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsDeploying(true);
    setDeployResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('deploy-lambda', {
        body: {
          functionName: formData.functionName,
          handler: formData.handler,
          runtime: formData.runtime,
          code: formData.code,
          roleArn: formData.roleArn
        }
      });

      if (error) throw error;

      if (data.success) {
        setDeployResult({
          success: true,
          message: data.message,
          arn: data.arn
        });
        toast.success("Lambda function deployed successfully!");
      } else {
        throw new Error(data.error || "Deployment failed");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to deploy Lambda function";
      setDeployResult({
        success: false,
        message: errorMessage
      });
      toast.error(errorMessage);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Deploy Lambda Function</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>AWS Lambda Deployment</CardTitle>
            <CardDescription>
              Deploy a new Lambda function or update an existing one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDeploy} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="functionName">Function Name *</Label>
                <Input
                  id="functionName"
                  placeholder="my-lambda-function"
                  value={formData.functionName}
                  onChange={(e) => setFormData({ ...formData, functionName: e.target.value })}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Only letters, numbers, hyphens, and underscores
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="runtime">Runtime *</Label>
                  <Select
                    value={formData.runtime}
                    onValueChange={(value) => setFormData({ ...formData, runtime: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nodejs20.x">Node.js 20.x</SelectItem>
                      <SelectItem value="nodejs18.x">Node.js 18.x</SelectItem>
                      <SelectItem value="python3.12">Python 3.12</SelectItem>
                      <SelectItem value="python3.11">Python 3.11</SelectItem>
                      <SelectItem value="python3.10">Python 3.10</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="handler">Handler *</Label>
                  <Input
                    id="handler"
                    placeholder="index.handler"
                    value={formData.handler}
                    onChange={(e) => setFormData({ ...formData, handler: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="roleArn">Lambda Execution Role ARN *</Label>
                <Input
                  id="roleArn"
                  placeholder="arn:aws:iam::123456789012:role/YourLambdaExecutionRole"
                  value={formData.roleArn}
                  onChange={(e) => setFormData({ ...formData, roleArn: e.target.value })}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  The IAM role ARN that Lambda assumes when executing your function
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Function Code *</Label>
                <Textarea
                  id="code"
                  placeholder="Enter your Lambda function code..."
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="min-h-[300px] font-mono text-sm"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Enter your Lambda function code (will be deployed as a zip file)
                </p>
              </div>

              {deployResult && (
                <Alert variant={deployResult.success ? "default" : "destructive"}>
                  <div className="flex items-start gap-2">
                    {deployResult.success ? (
                      <CheckCircle2 className="h-5 w-5 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <AlertDescription>
                        {deployResult.message}
                        {deployResult.arn && (
                          <div className="mt-2 p-2 bg-muted rounded text-xs break-all">
                            <strong>ARN:</strong> {deployResult.arn}
                          </div>
                        )}
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              )}

              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={isDeploying}
                  className="flex-1"
                >
                  {isDeploying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    "Deploy Function"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default LambdaDeploy;
