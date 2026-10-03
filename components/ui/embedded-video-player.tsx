"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProtectedVideo } from "@/components/ui/protected-video";
import { protectedIframeAllow, resolveVideoEmbed, type ResolvedVideoEmbed } from "@/lib/video-embed";
import { resolvePlayableVideoUrl } from "@/lib/resolve-playable-video-url";

interface EmbeddedVideoPlayerProps {
  embed: ResolvedVideoEmbed | null;
  /** Raw URL — used as a protected `<video>` fallback for non-embeddable links. */
  videoUrl?: string;
  /** Original stored key/URL so an expired signed URL can be refreshed. */
  sourceRef?: string;
  title: string;
  className?: string;
  autoPlay?: boolean;
}

function mediaTypeForUrl(url: string): string | undefined {
  const lower = url.toLowerCase();
  if (lower.includes(".webm")) return "video/webm";
  if (lower.includes(".ogg")) return "video/ogg";
  if (lower.includes(".mov")) return "video/quicktime";
  if (lower.includes(".mkv")) return "video/x-matroska";
  if (lower.includes(".m4v") || lower.includes(".mp4")) return "video/mp4";
  return undefined;
}

export function EmbeddedVideoPlayer({
  embed: embedProp,
  videoUrl,
  sourceRef,
  title,
  className,
}: EmbeddedVideoPlayerProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [embed, setEmbed] = useState(embedProp);
  const [directOverride, setDirectOverride] = useState<string | null>(null);
  const autoRetried = useRef(false);

  useEffect(() => {
    setVideoFailed(false);
    setRetrying(false);
    setEmbed(embedProp);
    setDirectOverride(null);
    autoRetried.current = false;
  }, [embedProp, videoUrl, sourceRef]);

  const retrySignedUrl = async (fromUser = false) => {
    const ref = (sourceRef || videoUrl || "").trim();
    if (!ref) {
      setVideoFailed(true);
      return;
    }
    setRetrying(true);
    try {
      const url = await resolvePlayableVideoUrl(ref);
      setDirectOverride(url);
      setEmbed(resolveVideoEmbed(url, false));
      setVideoFailed(false);
    } catch {
      setVideoFailed(true);
    } finally {
      setRetrying(false);
    }
  };

  if (
    embed &&
    (embed.type === "youtube" ||
      embed.type === "vimeo" ||
      embed.type === "google-drive")
  ) {
    return (
      <div
        className={cn("relative h-full w-full", className)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <iframe
          key={embed.embedUrl}
          src={embed.embedUrl}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow={protectedIframeAllow}
          allowFullScreen
        />
      </div>
    );
  }

  const directSrc = directOverride || (embed?.type === "direct" ? embed.embedUrl : videoUrl?.trim());
  if (directSrc && !videoFailed && !retrying) {
    const type = mediaTypeForUrl(directSrc);
    return (
      <ProtectedVideo
        key={directSrc}
        src={directSrc}
        controls
        autoPlay={false}
        preload="metadata"
        className={cn("h-full w-full object-contain", className)}
        onError={() => {
          if (autoRetried.current) {
            setVideoFailed(true);
            return;
          }
          autoRetried.current = true;
          void retrySignedUrl();
        }}
      >
        <source src={directSrc} {...(type ? { type } : {})} />
      </ProtectedVideo>
    );
  }

  const openHref = /^https?:\/\//i.test(directSrc ?? "") ? directSrc : undefined;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-6 text-center text-sm text-slate-300 gap-3 bg-slate-950",
        className
      )}
    >
      {retrying ? (
        <p>Refreshing video link…</p>
      ) : (
        <>
          <Video className="h-10 w-10 text-slate-500" />
          <p>{directSrc ? "Could not play this video." : "This video format cannot be played directly inside the player."}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {(sourceRef || videoUrl) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200"
                onClick={() => {
                  autoRetried.current = false;
                  void retrySignedUrl(true);
                }}
              >
                Retry
              </Button>
            )}
            {openHref && (
              <Button variant="outline" size="sm" asChild className="gap-2 border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200">
                <a href={openHref} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Open Video Link
                </a>
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
