"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Play } from "lucide-react";
import { EmbeddedVideoPlayer } from "@/components/ui/embedded-video-player";
import { resolveVideoEmbed, type ResolvedVideoEmbed } from "@/lib/video-embed";

interface WatchRecordingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  title: string;
}

export function WatchRecordingModal({ open, onOpenChange, videoUrl, title }: WatchRecordingModalProps) {
  const [embed, setEmbed] = useState<ResolvedVideoEmbed | null>(null);

  useEffect(() => {
    if (!videoUrl) {
      setEmbed(null);
      return;
    }
    setEmbed(resolveVideoEmbed(videoUrl, true));
  }, [videoUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl bg-slate-900 border-slate-800 text-slate-100 p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-4 border-b border-slate-800/60 bg-slate-950/40">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-cyan-400">
            <Play className="h-5 w-5 fill-cyan-400 text-cyan-400" />
            <span>Recording: {title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="relative aspect-video w-full bg-black flex items-center justify-center">
          <EmbeddedVideoPlayer embed={embed} videoUrl={videoUrl} title={`Class recording: ${title}`} autoPlay />
        </div>
      </DialogContent>
    </Dialog>
  );
}
