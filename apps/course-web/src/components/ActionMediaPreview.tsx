import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  buildVideoThumbnailCacheKey,
  readCachedVideoThumbnail,
  writeCachedVideoThumbnail
} from "../utils/videoThumbnailCache.ts";
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

interface CachedVideoThumbnailProps {
  src: string;
  cacheKey: string;
  alt: string;
  className?: string;
  interactive?: boolean;
  inlinePlayback?: boolean;
  lazy?: boolean;
  playLabel?: string;
  onPreviewClick?: () => void;
}

interface ActionVideoThumbnailProps {
  action: ActionMediaPreviewAction | null;
  className?: string;
  emptyCopy?: string;
  interactive?: boolean;
  inlinePlayback?: boolean;
  lazy?: boolean;
  playLabel?: string;
  onPreviewClick?: () => void;
}

const thumbnailRequests = new Map<string, Promise<Blob | null>>();

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

function createObjectUrl(blob: Blob) {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return "";
  }
  return URL.createObjectURL(blob);
}

function releaseObjectUrl(url: string) {
  if (url && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== "function") {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.82);
  });
}

function generateVideoThumbnailBlob(src: string): Promise<Blob | null> {
  if (typeof document === "undefined" || !src) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const video = document.createElement("video");
    let finished = false;
    let captureStarted = false;
    const timeout = window.setTimeout(() => finish(null), 18000);

    function cleanup() {
      window.clearTimeout(timeout);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("seeked", capture);
      video.removeEventListener("error", handleError);
      video.pause();
      video.removeAttribute("src");
      try {
        video.load();
      } catch {
        // Best-effort release for detached media elements.
      }
    }

    function finish(blob: Blob | null) {
      if (finished) {
        return;
      }
      finished = true;
      cleanup();
      resolve(blob);
    }

    async function capture() {
      if (finished || video.videoWidth <= 0 || video.videoHeight <= 0) {
        finish(null);
        return;
      }

      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        if (!context) {
          finish(null);
          return;
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(await canvasToBlob(canvas));
      } catch {
        finish(null);
      }
    }

    function handleLoadedMetadata() {
      if (captureStarted || finished) {
        return;
      }
      captureStarted = true;
      const nextTime = getVideoPreviewCaptureTime(video);
      try {
        if (nextTime > 0 && Math.abs(video.currentTime - nextTime) > 0.01) {
          video.currentTime = nextTime;
          return;
        }
      } catch {
        // Some browser/media combinations reject seeking before data is ready.
      }
      capture();
    }

    function handleLoadedData() {
      if (!captureStarted) {
        handleLoadedMetadata();
      }
    }

    function handleError() {
      finish(null);
    }

    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("seeked", capture);
    video.addEventListener("error", handleError);
    video.src = src;
    video.load();
  });
}

async function getOrCreateVideoThumbnail(cacheKey: string, src: string): Promise<Blob | null> {
  if (!src) {
    return null;
  }

  const cached = cacheKey ? await readCachedVideoThumbnail(cacheKey) : null;
  if (cached) {
    return cached;
  }

  const requestKey = `${cacheKey || "uncached"}|${src}`;
  const existingRequest = thumbnailRequests.get(requestKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = generateVideoThumbnailBlob(src)
    .then(async (blob) => {
      if (blob && cacheKey) {
        await writeCachedVideoThumbnail(cacheKey, blob, src);
      }
      return blob;
    })
    .finally(() => {
      thumbnailRequests.delete(requestKey);
    });

  thumbnailRequests.set(requestKey, request);
  return request;
}

function useLazyThumbnailGate(lazy: boolean) {
  const nodeRef = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(!lazy);

  useEffect(() => {
    setReady(!lazy);
  }, [lazy]);

  useEffect(() => {
    const node = nodeRef.current;
    if (!lazy || ready || !node) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setReady(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "360px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [lazy, ready]);

  return { nodeRef, ready };
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

export function CachedVideoThumbnail({
  src,
  cacheKey,
  alt,
  className = "",
  interactive = true,
  inlinePlayback = true,
  lazy = true,
  playLabel = "播放",
  onPreviewClick
}: CachedVideoThumbnailProps) {
  const { nodeRef, ready } = useLazyThumbnailGate(lazy);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setThumbnailUrl("");
    setIsPlaying(false);
    setFailed(false);
  }, [src, cacheKey]);

  useEffect(() => {
    if (!ready || !src) {
      return;
    }

    let cancelled = false;
    let objectUrl = "";

    getOrCreateVideoThumbnail(cacheKey, src).then((blob) => {
      if (cancelled) {
        return;
      }
      if (!blob) {
        setFailed(true);
        return;
      }
      objectUrl = createObjectUrl(blob);
      if (objectUrl) {
        setThumbnailUrl(objectUrl);
      } else {
        setFailed(true);
      }
    });

    return () => {
      cancelled = true;
      releaseObjectUrl(objectUrl);
    };
  }, [cacheKey, ready, src]);

  const classes = [
    "cached-video-thumbnail",
    className,
    interactive ? "is-interactive" : "",
    thumbnailUrl ? "has-frame" : "",
    failed ? "has-failed" : "",
    isPlaying ? "is-playing" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const content = isPlaying ? (
    <video key={src} src={src} controls autoPlay playsInline preload="auto" />
  ) : (
    <>
      {thumbnailUrl ? <img src={thumbnailUrl} alt={alt} /> : <span className="cached-video-thumbnail-placeholder">{ready ? "生成缩略图..." : "视频缩略图"}</span>}
      {interactive ? <span className="action-thumb-play">{playLabel}</span> : null}
    </>
  );

  if (!interactive) {
    return (
      <div ref={nodeRef as MutableRefObject<HTMLDivElement | null>} className={classes} aria-label={alt}>
        {content}
      </div>
    );
  }

  if (isPlaying && inlinePlayback && !onPreviewClick) {
    return (
      <div ref={nodeRef as MutableRefObject<HTMLDivElement | null>} className={classes} aria-label={`${playLabel} ${alt}`}>
        {content}
      </div>
    );
  }

  return (
    <button
      ref={nodeRef as MutableRefObject<HTMLButtonElement | null>}
      type="button"
      className={classes}
      onClick={(event) => {
        event.stopPropagation();
        if (onPreviewClick) {
          onPreviewClick();
          return;
        }
        if (inlinePlayback) {
          setIsPlaying(true);
        }
      }}
      aria-label={`${playLabel} ${alt}`}
    >
      {content}
    </button>
  );
}

export function ActionVideoThumbnail({
  action,
  className = "",
  emptyCopy = "无视频",
  interactive = true,
  inlinePlayback = true,
  lazy = true,
  playLabel = "播放",
  onPreviewClick
}: ActionVideoThumbnailProps) {
  const sourceUrl = action?.media?.url || "";
  const mediaUrl = sourceUrl ? withCacheToken(sourceUrl, action?.updateTime) : "";
  const cacheKey = sourceUrl
    ? buildVideoThumbnailCacheKey({
        actionId: action?.id,
        mediaUrl: sourceUrl,
        updateTime: action?.updateTime
      })
    : "";

  if (!mediaUrl) {
    const classes = ["cached-video-thumbnail", className, "is-empty"].filter(Boolean).join(" ");
    if (interactive) {
      return (
        <button type="button" className={classes} disabled aria-label={`${action?.name || "动作"} 暂无视频`}>
          <span>{emptyCopy}</span>
        </button>
      );
    }
    return (
      <div className={classes} aria-label={`${action?.name || "动作"} 暂无视频`}>
        <span>{emptyCopy}</span>
      </div>
    );
  }

  return (
    <CachedVideoThumbnail
      src={mediaUrl}
      cacheKey={cacheKey}
      alt={`${action?.name || "动作"}视频缩略图`}
      className={className}
      interactive={interactive}
      inlinePlayback={inlinePlayback}
      lazy={lazy}
      playLabel={playLabel}
      onPreviewClick={onPreviewClick}
    />
  );
}

export default function ActionMediaPreview({
  actionId,
  actions,
  emptyCopy = "请选择动作查看视频",
  compact = false,
  interactive = true
}: {
  actionId: string;
  actions: ActionMediaPreviewAction[];
  emptyCopy?: string;
  compact?: boolean;
  interactive?: boolean;
  autoPlayPreview?: boolean;
}) {
  const action = findActionRecord(actions, actionId);

  return (
    <div className={`action-media-preview${compact ? " is-compact" : ""}`}>
      <div className="action-media-preview-frame">
        {action?.media?.url ? (
          <ActionVideoThumbnail action={action} interactive={interactive} playLabel="点击播放" />
        ) : (
          <div className="action-media-preview-empty">{action ? "该动作暂无视频" : emptyCopy}</div>
        )}
      </div>
      <div className="action-media-preview-copy">
        <strong>{action?.name || "未选择动作"}</strong>
        <span>{action ? "已选动作缩略图，点击后播放视频" : "选中动作后显示缩略图，点击后播放视频"}</span>
      </div>
    </div>
  );
}
