"use client";

import { forwardRef, type VideoHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { protectedVideoProps } from "@/lib/video-embed";

export const ProtectedVideo = forwardRef<HTMLVideoElement, VideoHTMLAttributes<HTMLVideoElement>>(
  function ProtectedVideo(
    { className, onContextMenu, onDragStart, controlsList, disablePictureInPicture, playsInline, ...props },
    ref
  ) {
    return (
      <video
        ref={ref}
        {...props}
        controlsList={controlsList ?? protectedVideoProps.controlsList}
        disablePictureInPicture={disablePictureInPicture ?? protectedVideoProps.disablePictureInPicture}
        playsInline={playsInline ?? protectedVideoProps.playsInline}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu?.(e);
        }}
        onDragStart={(e) => {
          e.preventDefault();
          onDragStart?.(e);
        }}
        className={cn(className)}
      />
    );
  }
);
