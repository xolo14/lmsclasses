"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmbeddedVideoPlayer } from "@/components/ui/embedded-video-player";
import { resolveVideoEmbed, type ResolvedVideoEmbed } from "@/lib/video-embed";
import {
  PlayableVideoError,
  resolvePlayableVideoUrl,
} from "@/lib/resolve-playable-video-url";
import { prefetchVideoUrl } from "@/lib/video-prefetch";

interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title: string;
}

export function VideoPlayerModal({ isOpen, onClose, videoUrl, title }: VideoPlayerModalProps) {
  const [embed, setEmbed] = useState<ResolvedVideoEmbed | null>(null);
  const [playableUrl, setPlayableUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !videoUrl) {
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
        prefetchVideoUrl(url);
        setEmbed(resolveVideoEmbed(url, true));
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === "string"
            ? err
            : "Could not load this video.";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, videoUrl]);

  const handleClose = () => {
    setEmbed(null);
    setPlayableUrl(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
          {isOpen && videoUrl ? (
            loading ? (
              <div className="flex h-full items-center justify-center text-sm text-white/80">
                Loading course video…
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/80">
                {error}
              </div>
            ) : (
              <EmbeddedVideoPlayer
                embed={embed}
                videoUrl={playableUrl ?? undefined}
                title={title}
                autoPlay
              />
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
