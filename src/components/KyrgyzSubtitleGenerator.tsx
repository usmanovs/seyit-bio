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
  const [editedSubtitles, setEditedSubtitles] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [transcription, setTranscription] = useState<string>("");
  const [subtitleBlobUrl, setSubtitleBlobUrl] = useState<string | null>(null);
  const [parsedCues, setParsedCues] = useState<Array<{ start: number; end: number; text: string }>>([]);
  const [currentCueIndex, setCurrentCueIndex] = useState<number>(-1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLTrackElement>(null);
  const subtitleRefs = useRef<(HTMLDivElement | null)[]>([]);

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
      setCurrentCueIndex(-1);
      return;
    }
    const onTime = () => {
      const t = video.currentTime;
      const index = parsedCues.findIndex(c => t >= c.start && t <= c.end);
      setCurrentCueIndex(index);
    };
    video.addEventListener('timeupdate', onTime);
    onTime();
    return () => video.removeEventListener('timeupdate', onTime);
  }, [parsedCues, videoUrl]);

  useEffect(() => {
    if (currentCueIndex >= 0 && subtitleRefs.current[currentCueIndex]) {
      subtitleRefs.current[currentCueIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentCueIndex]);

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
      
      // Auto-generate subtitles after upload
      await generateSubtitlesForPath(fileName);
    } catch (error: any) {
      console.error("Error uploading video:", error);
      toast.error(error.message || "Failed to upload video");
    } finally {
      setIsUploading(false);
    }
  };

  const generateSubtitlesForPath = async (path: string) => {
    if (!path) {
      toast.error("Please upload a video first");
      return;
    }

    setIsGenerating(true);
    try {
      console.log('[KyrgyzSubtitleGenerator] Calling edge function with videoPath:', path);
      
      const { data, error } = await supabase.functions.invoke('generate-kyrgyz-subtitles', {
        body: { videoPath: path },
        headers: (await supabase.auth.getSession()).data.session?.access_token ? { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session!.access_token}` } : undefined,
      });

      console.log('[KyrgyzSubtitleGenerator] Response data:', data);
      console.log('[KyrgyzSubtitleGenerator] Response error:', error);

      if (error) throw error;

      setSubtitles(data.subtitles);
      setEditedSubtitles(data.subtitles);
      setHasUnsavedChanges(false);
      setTranscription(data.transcription);
      setParsedCues(parseSrtToCues(data.subtitles));
      
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

  const applySubtitleChanges = () => {
    setParsedCues(parseSrtToCues(editedSubtitles));
    const webvtt = convertSrtToWebVtt(editedSubtitles);
    const blob = new Blob([webvtt], { type: 'text/vtt' });
    const blobUrl = URL.createObjectURL(blob);
    setSubtitleBlobUrl(blobUrl);
    setSubtitles(editedSubtitles);
    setHasUnsavedChanges(false);
    toast.success("Captions updated");
  };

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };

  const handleCueTextChange = (index: number, newText: string) => {
    const newCues = [...parsedCues];
    newCues[index] = { ...newCues[index], text: newText };
    setParsedCues(newCues);
    
    // Convert back to SRT format
    const srt = newCues.map((cue, i) => {
      return `${i + 1}\n${formatTime(cue.start)} --> ${formatTime(cue.end)}\n${cue.text}\n`;
    }).join('\n');
    
    setEditedSubtitles(srt);
    setHasUnsavedChanges(true);
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
              </div>
            </div>

            {isGenerating && !subtitles && (
              <div className="flex items-center justify-center p-4 border rounded-lg">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Generating Kyrgyz subtitles...</span>
              </div>
            )}
          </div>
        )}

        {subtitles && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Subtitles (SRT Format) - Editable:
                {hasUnsavedChanges && <span className="text-amber-500 ml-2">(unsaved changes)</span>}
              </label>
              {currentCueIndex >= 0 && (
                <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded">
                  Currently playing: #{currentCueIndex + 1}
                </span>
              )}
            </div>
            
            <div className="border rounded-lg p-3 max-h-[400px] overflow-y-auto space-y-3 bg-muted/20">
              {parsedCues.map((cue, index) => (
                <div
                  key={index}
                  ref={(el) => subtitleRefs.current[index] = el}
                  className={`p-3 rounded-md border transition-all ${
                    currentCueIndex === index
                      ? 'bg-primary/10 border-primary shadow-sm scale-[1.02]'
                      : 'bg-background border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {formatTime(cue.start)} → {formatTime(cue.end)}
                    </span>
                  </div>
                  <Textarea
                    value={cue.text}
                    onChange={(e) => handleCueTextChange(index, e.target.value)}
                    className="min-h-[60px] text-sm resize-none bg-transparent border-0 p-0 focus-visible:ring-0"
                    placeholder="Subtitle text..."
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              {hasUnsavedChanges && (
                <Button
                  onClick={applySubtitleChanges}
                  className="flex-1"
                >
                  Update Captions
                </Button>
              )}
              <Button
                onClick={downloadSubtitles}
                variant="outline"
                className={hasUnsavedChanges ? "flex-1" : "w-full"}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Video
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
