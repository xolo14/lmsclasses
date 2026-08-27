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

interface DemoVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  courseTitle: string;
}

export function DemoVideoModal({ isOpen, onClose, videoUrl, courseTitle }: DemoVideoModalProps) {
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
  }, [isOpen, videoUrl]);

  const handleClose = () => {
    setEmbed(null);
    setPlayableUrl(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl border-swiss-black/10 bg-swiss-white text-swiss-black">
        <DialogHeader>
          <DialogTitle>Demo: {courseTitle}</DialogTitle>
        </DialogHeader>
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-white/80">
              Loading demo…
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/80">
              {error}
            </div>
          ) : (
            <EmbeddedVideoPlayer
              embed={embed}
              videoUrl={playableUrl ?? undefined}
              title={`Demo: ${courseTitle}`}
              autoPlay
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
