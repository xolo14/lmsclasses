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

interface DemoVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  courseTitle: string;
}

export function DemoVideoModal({ isOpen, onClose, videoUrl, courseTitle }: DemoVideoModalProps) {
  const [embed, setEmbed] = useState<ResolvedVideoEmbed | null>(null);

  useEffect(() => {
    if (isOpen && videoUrl) {
      setEmbed(resolveVideoEmbed(videoUrl, true));
    } else {
      setEmbed(null);
    }
  }, [isOpen, videoUrl]);

  const handleClose = () => {
    setEmbed(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl border-bg-border bg-bg-card text-text-primary">
        <DialogHeader>
          <DialogTitle>Demo: {courseTitle}</DialogTitle>
        </DialogHeader>
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
          <EmbeddedVideoPlayer
            embed={embed}
            videoUrl={videoUrl}
            title={`Demo: ${courseTitle}`}
            autoPlay
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
