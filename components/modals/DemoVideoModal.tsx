"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Play } from "lucide-react";

interface DemoVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  courseTitle: string;
}

export function DemoVideoModal({ open, onOpenChange, videoUrl, courseTitle }: DemoVideoModalProps) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [isDirectVideo, setIsDirectVideo] = useState(false);

  useEffect(() => {
    if (!videoUrl) {
      setEmbedUrl(null);
      setIsDirectVideo(false);
      return;
    }

    const trimmedUrl = videoUrl.trim();

    // YouTube regex
    const ytReg = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const ytMatch = trimmedUrl.match(ytReg);
    if (ytMatch && ytMatch[2].length === 11) {
      setEmbedUrl(`https://www.youtube.com/embed/${ytMatch[2]}?autoplay=1`);
      setIsDirectVideo(false);
      return;
    }

    // Vimeo regex
    const vimeoReg = /vimeo\.com\/(?:video\/)?([0-9]+)/;
    const vimeoMatch = trimmedUrl.match(vimeoReg);
    if (vimeoMatch) {
      setEmbedUrl(`https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`);
      setIsDirectVideo(false);
      return;
    }

    // Check direct video file types
    const directVideoRegex = /\.(mp4|webm|ogg|mov|m4v)(?:\?.*)?$/i;
    if (directVideoRegex.test(trimmedUrl)) {
      setIsDirectVideo(true);
      setEmbedUrl(trimmedUrl);
      return;
    }

    // Fallback — standard URL link out
    setEmbedUrl(null);
    setIsDirectVideo(false);
  }, [videoUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl bg-slate-900 border-slate-800 text-slate-100 p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-4 border-b border-slate-800/60 bg-slate-950/40">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-cyan-400">
            <Play className="h-5 w-5 fill-cyan-400 text-cyan-400" />
            <span>Demo: {courseTitle}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="relative aspect-video w-full bg-black flex items-center justify-center">
          {embedUrl && !isDirectVideo ? (
            <iframe
              src={embedUrl}
              title={`Demo video for ${courseTitle}`}
              className="absolute inset-0 w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : isDirectVideo && embedUrl ? (
            <video
              src={embedUrl}
              controls
              autoPlay
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
              <div className="h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 text-cyan-400 animate-pulse">
                <ExternalLink className="h-8 w-8" />
              </div>
              <p className="text-base text-slate-300 font-medium mb-2">
                External Media Link
              </p>
              <p className="text-sm text-slate-400 mb-6">
                This demo video link is external and cannot be embedded directly in the player.
              </p>
              <Button
                asChild
                className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold shadow-lg shadow-cyan-500/10 flex items-center gap-2"
              >
                <a href={videoUrl} target="_blank" rel="noopener noreferrer">
                  <span>Open Demo Video</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
