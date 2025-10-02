import { useState, useRef, useEffect } from "react";
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
  const [parsedCues, setParsedCues] = useState<Array<{ start: number; end: number; text: string }>>([]);
  const [activeCaption, setActiveCaption] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLTrackElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !subtitleBlobUrl) return;

    try { video.load(); } catch {}

    const showTracks = () => {
      const tracks = video.textTracks;
      console.log('[KyrgyzSubtitleGenerator] textTracks count:', tracks.length);
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = 'showing';
        console.log('[KyrgyzSubtitleGenerator] set track', i, 'mode to', tracks[i].mode, 'cues:', tracks[i].cues?.length ?? 0);
      }
    };

    video.addEventListener('loadeddata', showTracks, { once: true } as any);
    const t = trackRef.current;
    if (t) t.addEventListener('load', showTracks, { once: true } as any);
    const id = setTimeout(showTracks, 800);

    return () => {
      video.removeEventListener('loadeddata', showTracks as any);
      if (t) t.removeEventListener('load', showTracks as any);
      clearTimeout(id);
    };
  }, [subtitleBlobUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || parsedCues.length === 0) {
      setActiveCaption("");
      return;
    }
    const onTime = () => {
      const t = video.currentTime;
      const cue = parsedCues.find(c => t >= c.start && t <= c.end);
      setActiveCaption(cue ? cue.text : "");
    };
    video.addEventListener('timeupdate', onTime);
    onTime();
    return () => video.removeEventListener('timeupdate', onTime);
  }, [parsedCues, videoUrl]);

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
      console.log('[KyrgyzSubtitleGenerator] Calling edge function with videoPath:', videoPath);
      
      const { data, error } = await supabase.functions.invoke('generate-kyrgyz-subtitles', {
        body: { videoPath }
      });

      console.log('[KyrgyzSubtitleGenerator] Response data:', data);
      console.log('[KyrgyzSubtitleGenerator] Response error:', error);

      if (error) throw error;

      setSubtitles(data.subtitles);
      setTranscription(data.transcription);
      setParsedCues(parseSrtToCues(data.subtitles));
      setActiveCaption("");
      
      // Convert SRT to WebVTT format for video player
      const webvtt = convertSrtToWebVtt(data.subtitles);
      console.log('[KyrgyzSubtitleGenerator] WebVTT preview:', webvtt.substring(0, 200));
      const blob = new Blob([webvtt], { type: 'text/vtt' });
      const blobUrl = URL.createObjectURL(blob);
      setSubtitleBlobUrl(blobUrl);
      console.log('[KyrgyzSubtitleGenerator] Subtitles generated, cues:', parsedCues.length);
      toast.success("Kyrgyz subtitles generated successfully");
    } catch (error: any) {
      console.error("[KyrgyzSubtitleGenerator] Full error:", error);
      console.error("[KyrgyzSubtitleGenerator] Error context:", { message: error.message, context: error.context });
      toast.error(error.message || "Failed to generate subtitles");
    } finally {
      setIsGenerating(false);
    }
  };

  const convertSrtToWebVtt = (srt: string): string => {
    // Robust SRT -> WebVTT conversion: remove numeric cue IDs and fix timestamps
    const normalized = srt
      .replace(/\r+/g, '')
      .trim();

    const cues = normalized.split('\n\n').map(block => {
      const lines = block.split('\n');
      // Remove numeric cue identifier if present
      if (/^\d+$/.test(lines[0])) {
        lines.shift();
      }
      return lines.join('\n');
    }).join('\n\n');

    const withDots = cues.replace(/(\d+:\d+:\d+),(\d+)/g, '$1.$2');
    return 'WEBVTT\n\n' + withDots;
  };

  const parseSrtToCues = (srt: string) => {
    const normalized = srt.replace(/\r+/g, '').trim();
    const blocks = normalized.split('\n\n');
    const cues: Array<{ start: number; end: number; text: string }> = [];
    for (const block of blocks) {
      const lines = block.split('\n');
      if (!lines.length) continue;
      if (/^\d+$/.test(lines[0])) lines.shift();
      const timing = lines.shift() || '';
      const m = timing.match(/(\d+:\d+:\d+)[,.](\d+)\s+-->\s+(\d+:\d+:\d+)[,.](\d+)/);
      if (!m) continue;
      const start = hmsToSeconds(m[1], m[2]);
      const end = hmsToSeconds(m[3], m[4]);
      const text = lines.join('\n');
      cues.push({ start, end, text });
    }
    return cues;
  };

  const hmsToSeconds = (hms: string, ms: string) => {
    const [h, m, s] = hms.split(':').map(Number);
    return h * 3600 + m * 60 + s + Number(ms) / 1000;
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
              <div className="relative inline-block">
                <video 
                  key={subtitleBlobUrl || 'no-vtt'}
                  ref={videoRef}
                  src={videoUrl} 
                  controls 
                  className="rounded max-w-[500px] w-full"
                  crossOrigin="anonymous"
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      const tracks = videoRef.current.textTracks;
                      for (let i = 0; i < tracks.length; i++) tracks[i].mode = 'showing';
                    }
                  }}
                  onLoadedData={() => {
                    if (videoRef.current) {
                      const tracks = videoRef.current.textTracks;
                      for (let i = 0; i < tracks.length; i++) tracks[i].mode = 'showing';
                    }
                  }}
                >
                  {subtitleBlobUrl && (
                    <track 
                      kind="captions" 
                      src={subtitleBlobUrl} 
                      srcLang="ky" 
                      label="Kyrgyz"
                      default
                      ref={trackRef}
                    />
                  )}
                </video>
                {activeCaption && (
                  <div className="pointer-events-none absolute inset-x-2 bottom-2 flex justify-center">
                    <div className="max-w-[480px] rounded px-3 py-1.5 bg-background/80 text-foreground text-sm md:text-base leading-tight shadow-md">
                      {activeCaption.split('\n').map((line, i) => (
                        <span key={i}>
                          {line}
                          <br />
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
