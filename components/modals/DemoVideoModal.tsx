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
import {
  PlayableVideoError,
  resolvePlayableVideoUrl,
} from "@/lib/resolve-playable-video-url";

interface DemoVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  courseTitle: string;
}

export function DemoVideoModal({ open, onOpenChange, videoUrl, courseTitle }: DemoVideoModalProps) {
  const [embed, setEmbed] = useState<ResolvedVideoEmbed | null>(null);
  const [playableUrl, setPlayableUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !videoUrl) {
      setEmbed(null);
      setPlayableUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setEmbed(null);
    setPlayableUrl(null);

    (async () => {
      try {
        const url = await resolvePlayableVideoUrl(videoUrl);
        if (cancelled) return;
        setPlayableUrl(url);
        setEmbed(resolveVideoEmbed(url, true));
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof PlayableVideoError
            ? err.message
            : "Could not load this demo video."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, videoUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl bg-slate-900 border-slate-800 text-slate-100 p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-4 border-b border-slate-800/60 bg-slate-950/40">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-swiss-red">
            <Play className="h-5 w-5 fill-swiss-red text-swiss-red" />
            <span>Demo: {courseTitle}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="relative aspect-video w-full bg-black flex items-center justify-center">
          {loading ? (
            <p className="text-sm text-slate-400">Loading demo…</p>
          ) : error ? (
            <p className="p-6 text-center text-sm text-slate-400">{error}</p>
          ) : (
            <EmbeddedVideoPlayer
              embed={embed}
              videoUrl={playableUrl ?? undefined}
              title={`Demo video for ${courseTitle}`}
              autoPlay
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
