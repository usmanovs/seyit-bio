import { useState } from "react";
import { useConversation } from "@11labs/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mic, MicOff, Loader2 } from "lucide-react";

export const ElevenLabsVoice = () => {
  const [agentId, setAgentId] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  
  const conversation = useConversation({
    onConnect: () => {
      console.log("ElevenLabs conversation connected");
      toast.success("Voice conversation started");
    },
    onDisconnect: () => {
      console.log("ElevenLabs conversation disconnected");
      toast.info("Voice conversation ended");
    },
    onMessage: (message) => {
      console.log("Message received:", message);
    },
    onError: (error) => {
      console.error("ElevenLabs error:", error);
      toast.error("Voice conversation error");
    },
  });

  const startConversation = async () => {
    if (!agentId.trim()) {
      toast.error("Please enter an Agent ID");
      return;
    }

    setIsConnecting(true);
    try {
      // Request microphone access
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get signed URL from our edge function
      const { data, error } = await supabase.functions.invoke('elevenlabs-session', {
        body: { agentId: agentId.trim() }
      });

      if (error) throw error;

      if (!data?.signedUrl) {
        throw new Error("Failed to get signed URL");
      }

      // Start the conversation with the signed URL
      await conversation.startSession({ url: data.signedUrl });
    } catch (error: any) {
      console.error("Error starting conversation:", error);
      toast.error(error.message || "Failed to start conversation");
    } finally {
      setIsConnecting(false);
    }
  };

  const endConversation = async () => {
    try {
      await conversation.endSession();
    } catch (error: any) {
      console.error("Error ending conversation:", error);
      toast.error("Failed to end conversation");
    }
  };

  const isConnected = conversation.status === "connected";
  const isSpeaking = conversation.isSpeaking;

  return (
    <Card>
      <CardHeader>
        <CardTitle>ElevenLabs Voice Conversation</CardTitle>
        <CardDescription>
          Real-time voice AI powered by ElevenLabs Conversational AI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Enter your ElevenLabs Agent ID"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                disabled={isConnecting}
              />
              <p className="text-xs text-muted-foreground">
                Get your Agent ID from the ElevenLabs dashboard
              </p>
            </div>
            <Button 
              onClick={startConversation} 
              disabled={isConnecting || !agentId.trim()}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Start Voice Conversation
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center p-8 border-2 border-dashed rounded-lg">
              {isSpeaking ? (
                <div className="text-center space-y-2">
                  <Mic className="w-12 h-12 mx-auto text-primary animate-pulse" />
                  <p className="text-sm font-medium">AI is speaking...</p>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <Mic className="w-12 h-12 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Listening...</p>
                </div>
              )}
            </div>
            <Button 
              onClick={endConversation} 
              variant="destructive"
              className="w-full"
            >
              <MicOff className="w-4 h-4 mr-2" />
              End Conversation
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
