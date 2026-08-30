import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UploadedFile } from "./FileUploadZone";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { init } from "pptx-preview";

type PPTXPreviewer = ReturnType<typeof init>;

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

interface FileViewerProps {
  file: UploadedFile;
  currentSlide: number;
  totalSlides: number;
  onSlideChange?: (slide: number) => void;
  showControls?: boolean;
  onExit?: () => void;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export default function FileViewer({
  file,
  currentSlide,
  totalSlides,
  onSlideChange,
  showControls = true,
  onExit,
  fullscreen = false,
  onToggleFullscreen,
}: FileViewerProps) {
  // HTML files often bundle their own internal slide navigation (e.g. a
  // React deck listening to arrow keys). We can't know how many "slides"
  // are inside without executing that JS, so treat html as unbounded and
  // forward next/prev as real arrow-key presses into the iframe instead.
  const isHtml = file.type === "html";

  const goNext = () => {
    if (isHtml || currentSlide < totalSlides - 1) onSlideChange?.(currentSlide + 1);
  };
  const goPrev = () => {
    if (isHtml || currentSlide > 0) onSlideChange?.(currentSlide - 1);
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-background">
      {/* Slide indicator dots */}
      {!isHtml && (
        <div className="absolute left-6 top-6 z-10 flex items-center gap-2">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === currentSlide ? "w-8 bg-primary" : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>
      )}

      {/* Fullscreen toggle + exit (always available, even in remote-controlled mode) */}
      <div className="absolute right-6 top-6 z-10 flex items-center gap-2">
        {onExit && (
          <button
            onClick={onExit}
            className="rounded-lg bg-card/80 p-2 text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
            title="Sair da apresentação"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className="rounded-lg bg-card/80 p-2 text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
            title={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
          >
            {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
        )}
      </div>

      {/* Slide content */}
      <div
        className={`flex flex-1 items-center justify-center overflow-hidden ${
          fullscreen ? "h-full w-full p-2" : "w-full max-w-5xl px-8 py-16"
        }`}
      >
        {file.type === "html" && <HtmlSlide file={file} currentSlide={currentSlide} />}
        {file.type === "pdf" && <PdfSlide file={file} pageIndex={currentSlide} rounded={!fullscreen} />}
        {file.type === "pptx" && <PptxSlide file={file} slideIndex={currentSlide} rounded={!fullscreen} />}
      </div>

      {/* Bottom controls */}
      {showControls && (
        <div className="flex w-full items-center justify-between px-8 pb-8">
          <Button
            variant="secondary"
            size="lg"
            disabled={!isHtml && currentSlide === 0}
            onClick={goPrev}
            className="gap-2 rounded-xl"
          >
            <ChevronLeft className="h-5 w-5" />
            Voltar
          </Button>

          {!isHtml && (
            <span className="text-sm text-muted-foreground">
              {currentSlide + 1} / {totalSlides}
            </span>
          )}

          <Button
            size="lg"
            disabled={!isHtml && currentSlide === totalSlides - 1}
            onClick={goNext}
            className="gap-2 rounded-xl"
          >
            Avançar
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function HtmlSlide({ file, currentSlide }: { file: UploadedFile; currentSlide: number }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevSlideRef = useRef(currentSlide);
  const readyRef = useRef(false);

  useEffect(() => {
    readyRef.current = false;
    prevSlideRef.current = currentSlide;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  useEffect(() => {
    if (!readyRef.current) {
      prevSlideRef.current = currentSlide;
      return;
    }
    const delta = currentSlide - prevSlideRef.current;
    prevSlideRef.current = currentSlide;
    if (delta === 0) return;

    const win = iframeRef.current?.contentWindow;
    if (!win) return;

    const key = delta > 0 ? "ArrowRight" : "ArrowLeft";
    for (let i = 0; i < Math.abs(delta); i++) {
      win.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    }
  }, [currentSlide]);

  return (
    <iframe
      ref={iframeRef}
      src={file.url}
      title={file.file.name}
      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      className="h-full w-full rounded-2xl border border-border bg-white"
      onLoad={() => {
        readyRef.current = true;
        prevSlideRef.current = currentSlide;
      }}
    />
  );
}

function PdfSlide({
  file,
  pageIndex,
  rounded,
}: {
  file: UploadedFile;
  pageIndex: number;
  rounded: boolean;
}) {
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPdfDoc(null);
    file.file.arrayBuffer().then((buffer) => {
      pdfjsLib.getDocument({ data: buffer }).promise.then((doc) => {
        if (!cancelled) setPdfDoc(doc);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || size.width === 0 || size.height === 0) return;
    let cancelled = false;

    (async () => {
      const page = await pdfDoc.getPage(pageIndex + 1);
      if (cancelled) return;

      const canvas = canvasRef.current!;
      const context = canvas.getContext("2d");
      if (!context) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const scale =
        Math.min(size.width / baseViewport.width, size.height / baseViewport.height) *
        (window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / (window.devicePixelRatio || 1)}px`;
      canvas.style.height = `${viewport.height / (window.devicePixelRatio || 1)}px`;

      await page.render({ canvasContext: context, canvas, viewport }).promise;
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageIndex, size.width, size.height]);

  return (
    <div ref={containerRef} className="flex h-full w-full items-center justify-center">
      <canvas
        ref={canvasRef}
        className={`max-h-full max-w-full bg-white shadow-2xl ${
          rounded ? "rounded-2xl border border-border" : ""
        }`}
      />
    </div>
  );
}

function PptxSlide({
  file,
  slideIndex,
  rounded,
}: {
  file: UploadedFile;
  slideIndex: number;
  rounded: boolean;
}) {
  const PPTX_WIDTH = 1280;
  const PPTX_HEIGHT = 720;

  const [wrapperRef, size] = useElementSize<HTMLDivElement>();
  const containerRef = useRef<HTMLDivElement>(null);
  const previewerRef = useRef<PPTXPreviewer | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    setReady(false);
    let cancelled = false;

    const previewer = init(containerRef.current, {
      width: PPTX_WIDTH,
      height: PPTX_HEIGHT,
      mode: "slide",
    });
    previewerRef.current = previewer;

    file.file.arrayBuffer().then((buffer) =>
      previewer.load(buffer).then(() => {
        if (!cancelled) setReady(true);
      })
    );

    return () => {
      cancelled = true;
      previewer.destroy();
      previewerRef.current = null;
    };
  }, [file]);

  useEffect(() => {
    if (!ready || !previewerRef.current) return;
    previewerRef.current.renderSingleSlide(slideIndex);
  }, [ready, slideIndex]);

  const scale =
    size.width > 0 && size.height > 0
      ? Math.min(size.width / PPTX_WIDTH, size.height / PPTX_HEIGHT)
      : 1;

  return (
    <div ref={wrapperRef} className="flex h-full w-full items-center justify-center overflow-hidden">
      <div
        style={{
          width: PPTX_WIDTH,
          height: PPTX_HEIGHT,
          transform: `scale(${scale})`,
        }}
        className="shrink-0"
      >
        <div
          ref={containerRef}
          className={`bg-white shadow-2xl ${rounded ? "rounded-2xl border border-border" : ""}`}
        />
      </div>
    </div>
  );
}
