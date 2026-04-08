import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, FileText, FileImage, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UploadedFile } from "./FileUploadZone";

interface FileViewerProps {
  file: UploadedFile;
  currentSlide: number;
  totalSlides: number;
  onSlideChange?: (slide: number) => void;
  showControls?: boolean;
}

const MOCK_SLIDES = [
  { title: "Slide 1 — Introdução", subtitle: "Bem-vindo à apresentação", color: "from-primary/20 to-primary/5" },
  { title: "Slide 2 — Conteúdo Principal", subtitle: "Dados e informações relevantes", color: "from-blue-500/20 to-blue-500/5" },
  { title: "Slide 3 — Conclusão", subtitle: "Próximos passos e ações", color: "from-emerald-500/20 to-emerald-500/5" },
];

const FILE_ICON = { pdf: FileText, pptx: FileImage, html: Globe };

export default function FileViewer({
  file,
  currentSlide,
  totalSlides,
  onSlideChange,
  showControls = true,
}: FileViewerProps) {
  const [fullscreen, setFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }, []);

  const goNext = () => {
    if (currentSlide < totalSlides - 1) onSlideChange?.(currentSlide + 1);
  };
  const goPrev = () => {
    if (currentSlide > 0) onSlideChange?.(currentSlide - 1);
  };

  const slide = MOCK_SLIDES[currentSlide] ?? MOCK_SLIDES[0];
  const Icon = FILE_ICON[file.type];

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-background">
      {/* Slide indicator dots */}
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

      {/* Fullscreen toggle */}
      {showControls && (
        <button
          onClick={toggleFullscreen}
          className="absolute right-6 top-6 z-10 rounded-lg bg-card/80 p-2 text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
        >
          {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>
      )}

      {/* Mock slide content */}
      <div className="flex w-full max-w-4xl flex-1 items-center justify-center px-8">
        <div
          className={`flex w-full flex-col items-center justify-center gap-6 rounded-3xl bg-gradient-to-br ${slide.color} border border-border p-16 transition-all duration-500`}
          key={currentSlide}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-4xl font-bold text-foreground">{slide.title}</h2>
          <p className="text-lg text-muted-foreground">{slide.subtitle}</p>
          <p className="mt-4 rounded-lg bg-card/60 px-4 py-2 text-xs text-muted-foreground">
            Renderizando: <span className="font-mono text-foreground">{file.file.name}</span>
          </p>
        </div>
      </div>

      {/* Bottom controls */}
      {showControls && (
        <div className="flex w-full items-center justify-between px-8 pb-8">
          <Button
            variant="secondary"
            size="lg"
            disabled={currentSlide === 0}
            onClick={goPrev}
            className="gap-2 rounded-xl"
          >
            <ChevronLeft className="h-5 w-5" />
            Voltar
          </Button>

          <span className="text-sm text-muted-foreground">
            {currentSlide + 1} / {totalSlides}
          </span>

          <Button
            size="lg"
            disabled={currentSlide === totalSlides - 1}
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
