import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2, Download, Video } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export const KyrgyzSubtitleGenerator = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<string>("");
  const [transcription, setTranscription] = useState<string>("");
  const [subtitleBlobUrl, setSubtitleBlobUrl] = useState<string | null>(null);
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
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Upload to storage
      const fileName = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      setVideoUrl(publicUrl);
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
      setTranscription(data.transcription);
      
      // Convert SRT to WebVTT format for video player
      const webvtt = convertSrtToWebVtt(data.subtitles);
      const blob = new Blob([webvtt], { type: 'text/vtt' });
      const blobUrl = URL.createObjectURL(blob);
      setSubtitleBlobUrl(blobUrl);
      
      toast.success("Kyrgyz subtitles generated successfully");
    } catch (error: any) {
      console.error("Error generating subtitles:", error);
      toast.error(error.message || "Failed to generate subtitles");
    } finally {
      setIsGenerating(false);
    }
  };

  const convertSrtToWebVtt = (srt: string): string => {
    // Convert SRT to WebVTT format
    return 'WEBVTT\n\n' + srt.replace(/(\d+:\d+:\d+),(\d+)/g, '$1.$2');
  };

  const downloadSubtitles = () => {
    if (!subtitles) return;

    const blob = new Blob([subtitles], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitles_kyrgyz.srt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success("Subtitles downloaded");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kyrgyz Video Subtitle Generator</CardTitle>
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
            disabled={isUploading}
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
            <div className="border rounded-lg p-2 flex justify-center">
              <video 
                ref={videoRef}
                src={videoUrl} 
                controls 
                className="rounded max-w-[500px] w-full"
                crossOrigin="anonymous"
                onLoadedMetadata={() => {
                  if (videoRef.current && subtitleBlobUrl) {
                    const tracks = videoRef.current.textTracks;
                    if (tracks.length > 0) {
                      tracks[0].mode = 'showing';
                    }
                  }
                }}
              >
                {subtitleBlobUrl && (
                  <track 
                    kind="subtitles" 
                    src={subtitleBlobUrl} 
                    srcLang="ky" 
                    label="Kyrgyz"
                    default
                  />
                )}
              </video>
            </div>

            {!subtitles && (
              <Button
                onClick={generateSubtitles}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Kyrgyz Subtitles...
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4 mr-2" />
                    Generate Kyrgyz Subtitles
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {transcription && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Transcription (Kyrgyz):</label>
            <Textarea 
              value={transcription} 
              readOnly
              className="min-h-[100px]"
            />
          </div>
        )}

        {subtitles && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Subtitles (SRT Format):</label>
            <Textarea 
              value={subtitles} 
              readOnly
              className="min-h-[150px] font-mono text-xs"
            />
            <Button
              onClick={downloadSubtitles}
              variant="outline"
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              Download SRT File
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
