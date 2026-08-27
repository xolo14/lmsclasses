"use client";

import { useEffect, useState } from "react";
import { EmbeddedVideoPlayer } from "@/components/ui/embedded-video-player";
import { resolveVideoEmbed, type ResolvedVideoEmbed } from "@/lib/video-embed";
import {
  PlayableVideoError,
  resolvePlayableVideoUrl,
} from "@/lib/resolve-playable-video-url";
import { cn } from "@/lib/utils";

type ResolvedVideoPlayerProps = {
  videoUrl: string;
  title: string;
  autoPlay?: boolean;
  className?: string;
};

/** Resolves GCS keys to signed URLs, then plays via EmbeddedVideoPlayer. */
export function ResolvedVideoPlayer({
  videoUrl,
  title,
  autoPlay = false,
  className,
}: ResolvedVideoPlayerProps) {
  const [embed, setEmbed] = useState<ResolvedVideoEmbed | null>(null);
  const [playableUrl, setPlayableUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = videoUrl.trim();
    if (!raw) {
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
        const url = await resolvePlayableVideoUrl(raw);
        if (cancelled) return;
        setPlayableUrl(url);
        setEmbed(resolveVideoEmbed(url, autoPlay));
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof PlayableVideoError
            ? err.message
            : "Could not load this video."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [videoUrl, autoPlay]);

  if (loading) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[12rem] items-center justify-center bg-black text-sm text-white/80",
          className
        )}
      >
        Loading video…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[12rem] items-center justify-center bg-black p-6 text-center text-sm text-white/80",
          className
        )}
      >
        {error}
      </div>
    );
  }

  return (
    <EmbeddedVideoPlayer
      embed={embed}
      videoUrl={playableUrl ?? undefined}
      title={title}
      autoPlay={autoPlay}
      className={className}
    />
  );
}
