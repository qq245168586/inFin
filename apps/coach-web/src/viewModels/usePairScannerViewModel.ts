import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import type { BarcodeDetectorShape, ParsedPairPayload } from "../models/screens";
import { barcodeDetectorApi, parsePairPayload } from "../utils/screens";

export function usePairScannerViewModel(onParsed: (payload: ParsedPairPayload) => void) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorShape | null>(null);
  const frameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startingRef = useRef(false);

  function applyPairPayload(rawValue: string) {
    const parsed = parsePairPayload(rawValue);
    if (!parsed) {
      setScannerError("没有识别到有效的 TV 配对二维码。");
      return false;
    }
    setScannerError("");
    onParsed(parsed);
    return true;
  }

  function stopScanner() {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    detectorRef.current = null;
    setScannerOpen(false);
  }

  function canvasContext(width: number, height: number) {
    const canvas = canvasRef.current || document.createElement("canvas");
    canvasRef.current = canvas;
    canvas.width = Math.max(1, Math.floor(width));
    canvas.height = Math.max(1, Math.floor(height));
    return canvas.getContext("2d", { willReadFrequently: true });
  }

  async function detectWithBarcodeDetector(source: CanvasImageSource): Promise<string> {
    const Detector = barcodeDetectorApi();
    if (!Detector) return "";
    try {
      const detector = detectorRef.current || new Detector({ formats: ["qr_code"] });
      detectorRef.current = detector;
      const detected = await detector.detect(source);
      return detected.find((item) => item?.rawValue)?.rawValue || "";
    } catch {
      return "";
    }
  }

  function detectWithJsQr(source: CanvasImageSource, width: number, height: number): string {
    const context = canvasContext(width, height);
    if (!context) return "";
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.drawImage(source, 0, 0, context.canvas.width, context.canvas.height);
    const imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    return jsQR(imageData.data, context.canvas.width, context.canvas.height, { inversionAttempts: "attemptBoth" })?.data || "";
  }

  async function detectPairPayload(source: CanvasImageSource, width: number, height: number): Promise<string> {
    return (await detectWithBarcodeDetector(source)) || detectWithJsQr(source, width, height);
  }

  async function startScanner() {
    if (startingRef.current || scannerOpen) return;
    if (!window.isSecureContext) {
      setScannerError("当前页面不是安全地址（HTTPS），浏览器会拦截摄像头。请改用 HTTPS 打开 coach 页面，或先上传二维码照片。");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError("当前浏览器没有开放摄像头接口，请改用上传二维码照片或手动粘贴配对字符串。");
      return;
    }
    startingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      setScannerError("");
      setScannerOpen(true);
      const video = await waitForVideo();
      video.srcObject = stream;
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      await waitForMetadata(video);
      await video.play().catch(() => undefined);
      void scanLoop();
    } catch (error) {
      stopScanner();
      const message = error instanceof Error ? error.message : "打开摄像头失败。";
      setScannerError(/secure|https|permission|denied|notallowed/i.test(message) ? `摄像头权限未成功打开：${message}` : message);
    } finally {
      startingRef.current = false;
    }
  }

  async function waitForVideo(): Promise<HTMLVideoElement> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
      if (videoRef.current) return videoRef.current;
    }
    throw new Error("扫码预览初始化失败。");
  }

  async function waitForMetadata(video: HTMLVideoElement) {
    if (video.readyState >= 1) return;
    await new Promise<void>((resolve) => {
      const done = () => {
        video.removeEventListener("loadedmetadata", done);
        resolve();
      };
      video.addEventListener("loadedmetadata", done, { once: true });
      window.setTimeout(done, 1200);
    });
  }

  async function scanLoop() {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (video.readyState >= 2) {
        const raw = await detectPairPayload(video, video.videoWidth || video.clientWidth || 1280, video.videoHeight || video.clientHeight || 720);
        if (raw && applyPairPayload(raw)) {
          stopScanner();
          return;
        }
      }
    } catch {
      // A bad frame should not stop scanning.
    }
    frameRef.current = window.requestAnimationFrame(() => void scanLoop());
  }

  async function handleQrImageSelected(file: File | null) {
    if (!file) return;
    try {
      const imageUrl = URL.createObjectURL(file);
      const image = new Image();
      image.src = imageUrl;
      await image.decode();
      URL.revokeObjectURL(imageUrl);
      const raw = await detectPairPayload(image, image.naturalWidth || image.width || 1, image.naturalHeight || image.height || 1);
      if (!raw || !applyPairPayload(raw)) setScannerError("这张图片里没有识别到有效的 TV 配对二维码。");
    } catch (error) {
      setScannerError(error instanceof Error ? error.message : "识别二维码图片失败。");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  useEffect(() => () => stopScanner(), []);

  return { applyPairPayload, fileInputRef, handleQrImageSelected, scannerError, scannerOpen, setScannerError, startScanner, stopScanner, videoRef };
}

