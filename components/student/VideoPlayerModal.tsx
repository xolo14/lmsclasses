"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getYouTubeEmbedUrl, isYouTubeUrl } from "@/lib/youtube";

interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title: string;
}

export function VideoPlayerModal({ isOpen, onClose, videoUrl, title }: VideoPlayerModalProps) {
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && videoUrl) {
      if (isYouTubeUrl(videoUrl)) {
        setEmbedSrc(getYouTubeEmbedUrl(videoUrl, true));
      } else {
        setEmbedSrc(videoUrl);
      }
    } else {
      setEmbedSrc(null);
    }
  }, [isOpen, videoUrl]);

  const handleClose = () => {
    setEmbedSrc(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
          {embedSrc && isYouTubeUrl(videoUrl) && (
            <iframe
              key={embedSrc}
              src={embedSrc}
              title={title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
          {embedSrc && !isYouTubeUrl(videoUrl) && (
            <video key={embedSrc} src={embedSrc} controls autoPlay className="h-full w-full" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
