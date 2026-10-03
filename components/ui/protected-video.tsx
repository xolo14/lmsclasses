"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type VideoHTMLAttributes,
} from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { protectedVideoProps } from "@/lib/video-embed";
import { recoverVideoDuration } from "@/lib/video-duration";

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
      autoPlay = false,
      ...props
    },
    ref
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [buffering, setBuffering] = useState(true);
    const [paused, setPaused] = useState(true);

    useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

    useEffect(() => {
      setBuffering(true);
      setPaused(true);
    }, [props.src, props.children]);

    const togglePlayback = () => {
      const el = videoRef.current;
      if (!el) return;
      if (el.paused) void el.play().catch(() => undefined);
      else el.pause();
    };

    return (
      <div className={cn("group/video relative h-full w-full", className)}>
        <video
          ref={videoRef}
          {...props}
          autoPlay={false}
          preload={preload ?? (autoPlay ? "auto" : "metadata")}
          controlsList={protectedVideoProps.controlsList}
          disablePictureInPicture={protectedVideoProps.disablePictureInPicture}
          playsInline={protectedVideoProps.playsInline}
          onLoadStart={(e) => {
            setBuffering(true);
            setPaused(true);
            onLoadStart?.(e);
          }}
          onLoadedMetadata={(e) => {
            recoverVideoDuration(e.currentTarget);
            setBuffering(false);
            setPaused(e.currentTarget.paused);
            props.onLoadedMetadata?.(e);
          }}
          onDurationChange={(e) => {
            recoverVideoDuration(e.currentTarget);
            props.onDurationChange?.(e);
          }}
          onWaiting={(e) => {
            setBuffering(true);
            onWaiting?.(e);
          }}
          onPlaying={(e) => {
            setBuffering(false);
            setPaused(false);
            onPlaying?.(e);
          }}
          onCanPlay={(e) => {
            setBuffering(false);
            onCanPlay?.(e);
          }}
          onPlay={(e) => {
            setBuffering(false);
            setPaused(false);
            props.onPlay?.(e);
          }}
          onPause={(e) => {
            setBuffering(false);
            setPaused(true);
            props.onPause?.(e);
          }}
          onEnded={(e) => {
            setPaused(true);
            props.onEnded?.(e);
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
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-xs text-white/80">Loading video…</p>
          </div>
        )}
        {!(showBuffering && buffering) && (
          <button
            type="button"
            aria-label={paused ? "Play video" : "Pause video"}
            onClick={togglePlayback}
            className={cn(
              "absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white shadow-lg transition-opacity hover:bg-black/80",
              paused ? "opacity-100" : "opacity-0 group-hover/video:opacity-100"
            )}
          >
            {paused ? <Play className="h-8 w-8 fill-white" /> : <Pause className="h-8 w-8 fill-white" />}
          </button>
        )}
      </div>
    );
  }
);
