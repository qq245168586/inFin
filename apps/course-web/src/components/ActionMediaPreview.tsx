import { useEffect, useRef, useState } from "react";
import { withCacheToken } from "../utils/url.ts";

interface ActionMedia {
  url: string;
}

export interface ActionMediaPreviewAction {
  id: number;
  name: string;
  typeIds?: number[];
  courseTags?: string[];
  updateTime?: string;
  media?: ActionMedia | null;
}

function findActionRecord(actions: ActionMediaPreviewAction[], actionId: string): ActionMediaPreviewAction | null {
  return actions.find((item) => String(item.id) === String(actionId)) ?? null;
}

function getVideoPreviewCaptureTime(video: HTMLVideoElement) {
  const duration = Number(video.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0.08;
  }

  return Math.min(0.12, Math.max(duration * 0.02, 0.04), Math.max(duration - 0.01, 0));
}

export function FirstFrameVideo({
  src,
  className,
  interactive = true,
  autoPlayPreview = false
}: {
  src: string;
  className?: string;
  interactive?: boolean;
  autoPlayPreview?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureStateRef = useRef<"idle" | "seeking" | "done">("idle");
  const [posterUrl, setPosterUrl] = useState("");

  useEffect(() => {
    setPosterUrl("");
    captureStateRef.current = "idle";
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) {
      return;
    }

    if (autoPlayPreview) {
      const playMutedPreview = () => {
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
            // Autoplay can still be blocked by the browser; retry on media readiness events.
          });
        }
      };

      playMutedPreview();
      video.addEventListener("loadeddata", playMutedPreview);
      video.addEventListener("canplay", playMutedPreview);

      return () => {
        video.removeEventListener("loadeddata", playMutedPreview);
        video.removeEventListener("canplay", playMutedPreview);
      };
    }

    let cancelled = false;

    const finalize = () => {
      if (cancelled) {
        return;
      }

      captureStateRef.current = "done";
      video.pause();
    };

    const capturePoster = () => {
      if (captureStateRef.current === "done") {
        return;
      }

      try {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const context = canvas.getContext("2d");

          if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const nextPosterUrl = canvas.toDataURL("image/jpeg", 0.86);
            if (!cancelled) {
              setPosterUrl(nextPosterUrl);
            }
          }
        }
      } catch {
        // Direct OSS links may not always allow canvas export. In that case we still
        // keep the preview parked on the first visible frame instead of a black panel.
      }

      finalize();
    };

    const handleLoadedData = () => {
      const nextTime = getVideoPreviewCaptureTime(video);
      if (captureStateRef.current === "idle" && nextTime > 0 && Math.abs(video.currentTime - nextTime) > 0.01) {
        captureStateRef.current = "seeking";
        try {
          video.currentTime = nextTime;
          return;
        } catch {
          // Ignore seek failures and fall through to direct capture.
        }
      }

      capturePoster();
    };

    const handleSeeked = () => {
      if (captureStateRef.current === "seeking") {
        capturePoster();
      }
    };

    const handleError = () => {
      finalize();
    };

    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("error", handleError);

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };
  }, [src, autoPlayPreview]);

  return (
    <video
      key={src}
      ref={videoRef}
      className={className}
      src={src}
      poster={posterUrl || undefined}
      controls={interactive}
      autoPlay={autoPlayPreview}
      muted={autoPlayPreview}
      loop={autoPlayPreview}
      playsInline
      preload="auto"
      tabIndex={interactive ? undefined : -1}
      aria-hidden={interactive ? undefined : true}
      onPlay={() => {
        const video = videoRef.current;
        if (!video) {
          return;
        }

        if (video.currentTime > 0 && video.currentTime < 0.2) {
          video.currentTime = 0;
        }
      }}
    />
  );
}

export default function ActionMediaPreview({
  actionId,
  actions,
  emptyCopy = "请选择动作查看视频",
  compact = false,
  interactive = true,
  autoPlayPreview = false
}: {
  actionId: string;
  actions: ActionMediaPreviewAction[];
  emptyCopy?: string;
  compact?: boolean;
  interactive?: boolean;
  autoPlayPreview?: boolean;
}) {
  const action = findActionRecord(actions, actionId);
  const mediaUrl = action?.media?.url ? withCacheToken(action.media.url, action.updateTime) : "";

  return (
    <div className={`action-media-preview${compact ? " is-compact" : ""}`}>
      <div className="action-media-preview-frame">
        {mediaUrl ? (
          <FirstFrameVideo src={mediaUrl} interactive={interactive} autoPlayPreview={autoPlayPreview} />
        ) : (
          <div className="action-media-preview-empty">{action ? "该动作暂无视频" : emptyCopy}</div>
        )}
      </div>
      <div className="action-media-preview-copy">
        <strong>{action?.name || "未选择动作"}</strong>
        <span>{action ? "已选动作视频预览，可直接播放确认" : "选中动作后可直接预览视频"}</span>
      </div>
    </div>
  );
}
