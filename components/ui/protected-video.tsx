"use client";

import { forwardRef, useEffect, useState, type VideoHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { protectedVideoProps } from "@/lib/video-embed";

type ProtectedVideoProps = VideoHTMLAttributes<HTMLVideoElement> & {
  /** Show a loading overlay until enough media is buffered to play. */
  showBuffering?: boolean;
};

export const ProtectedVideo = forwardRef<HTMLVideoElement, ProtectedVideoProps>(
  function ProtectedVideo(
    {
      className,
      onContextMenu,
      onDragStart,
      onWaiting,
      onPlaying,
      onCanPlay,
      onLoadStart,
      controlsList: _controlsList,
      disablePictureInPicture: _pip,
      playsInline: _playsInline,
      preload,
      showBuffering = true,
      autoPlay,
      ...props
    },
    ref
  ) {
    const [buffering, setBuffering] = useState(true);

    useEffect(() => {
      setBuffering(true);
    }, [props.src, props.children]);

    return (
      <div className={cn("relative h-full w-full", className)}>
        <video
          ref={ref}
          {...props}
          autoPlay={autoPlay}
          // metadata = duration/size quickly; auto when we intend to play immediately
          preload={preload ?? (autoPlay ? "auto" : "metadata")}
          controlsList={protectedVideoProps.controlsList}
          disablePictureInPicture={protectedVideoProps.disablePictureInPicture}
          playsInline={protectedVideoProps.playsInline}
          onLoadStart={(e) => {
            setBuffering(true);
            onLoadStart?.(e);
          }}
          onWaiting={(e) => {
            setBuffering(true);
            onWaiting?.(e);
          }}
          onPlaying={(e) => {
            setBuffering(false);
            onPlaying?.(e);
          }}
          onCanPlay={(e) => {
            setBuffering(false);
            onCanPlay?.(e);
          }}
          onError={(e) => {
            setBuffering(false);
            props.onError?.(e);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            onContextMenu?.(e);
          }}
          onDragStart={(e) => {
            e.preventDefault();
            onDragStart?.(e);
          }}
          className="h-full w-full object-contain"
        />
        {showBuffering && buffering && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-xs text-white/80">Loading video…</p>
          </div>
        )}
      </div>
    );
  }
);
