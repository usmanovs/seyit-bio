import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Download, Loader2, Play } from "lucide-react";

export const VideoSubtitleKyrgyz = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoPath, setVideoPath] = useState<string>("");
  const [subtitles, setSubtitles] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast.error("Please select a video file");
      return;
    }

    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast.error("Video file must be less than 100MB");
      return;
    }

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      setVideoUrl(data.publicUrl);
      setVideoPath(fileName);
      toast.success("Video uploaded successfully");
    } catch (error: any) {
      console.error("Error uploading video:", error);
      toast.error(error.message || "Failed to upload video");
    } finally {
      setIsUploading(false);
    }
  };

  const generateSubtitles = async () => {
    if (!videoPath) {
      toast.error("Please upload a video first");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-kyrgyz-subtitles', {
        body: { videoPath }
      });

      if (error) throw error;

      setSubtitles(data.subtitles);
      toast.success("Kyrgyz subtitles generated successfully");
    } catch (error: any) {
      console.error("Error generating subtitles:", error);
      toast.error(error.message || "Failed to generate subtitles");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadSubtitles = () => {
    if (!subtitles) return;

    const blob = new Blob([subtitles], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitles_kyrgyz.srt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Subtitles downloaded");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Video Subtitles - Kyrgyz</CardTitle>
        <CardDescription>
          Upload a video and generate Kyrgyz subtitles using ElevenLabs ASR
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isGenerating}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload Video
              </>
            )}
          </Button>
        </div>

        {videoUrl && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Play className="w-4 h-4" />
              <span>Video Preview</span>
            </div>
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="w-full rounded-lg border"
              style={{ maxHeight: '300px' }}
            />
          </div>
        )}

        {videoPath && !subtitles && (
          <Button 
            onClick={generateSubtitles}
            disabled={isGenerating}
            className="w-full"
            variant="secondary"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Kyrgyz Subtitles...
              </>
            ) : (
              "Generate Kyrgyz Subtitles"
            )}
          </Button>
        )}

        {subtitles && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">Generated Subtitles (SRT):</label>
              <Button
                onClick={downloadSubtitles}
                size="sm"
                variant="outline"
              >
                <Download className="w-4 h-4 mr-2" />
                Download SRT
              </Button>
            </div>
            <Textarea 
              value={subtitles}
              readOnly
              className="min-h-[200px] font-mono text-xs"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
