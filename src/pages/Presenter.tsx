import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "react-qr-code";
import { Play, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

const SLIDES = [
  {
    title: "Bem-vindo ao Playbook Comercial",
    subtitle: "Estratégias que transformam resultados",
    content: "Descubra as melhores práticas para alavancar suas vendas e conquistar novos mercados.",
  },
  {
    title: "Metodologia de Vendas",
    subtitle: "O framework que gera conversões",
    content: "Entenda o funil completo: prospecção, qualificação, proposta e fechamento.",
  },
  {
    title: "Próximos Passos",
    subtitle: "Implementação e acompanhamento",
    content: "Defina metas claras, acompanhe KPIs e itere com base nos dados coletados.",
  },
];

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function Presenter() {
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [started, setStarted] = useState(false);

  // Create session on mount
  useEffect(() => {
    const code = generateCode();
    supabase
      .from("sessions")
      .insert({ session_code: code })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error("Error creating session:", error);
          return;
        }
        setSessionCode(data.session_code);
        setSessionId(data.id);
      });
  }, []);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const newSlide = payload.new.current_slide as number;
          setCurrentSlide(newSlide);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const controlUrl = sessionCode
    ? `${window.location.origin}/controle?code=${sessionCode}`
    : "";

  if (!sessionCode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Criando sessão...</div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Monitor className="h-5 w-5" />
          <span className="text-sm font-medium uppercase tracking-widest">Playbook Comercial</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl">
          <QRCode
            value={controlUrl}
            size={240}
            bgColor="transparent"
            fgColor="hsl(0, 0%, 95%)"
            level="M"
          />
        </div>

        <div className="text-center">
          <p className="mb-1 text-lg font-semibold text-foreground">
            Código da sessão: <span className="text-primary">{sessionCode}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Escaneie o QR Code com seu smartphone para controlar a apresentação
          </p>
        </div>

        <Button
          size="lg"
          className="gap-2 rounded-xl px-8 text-base"
          onClick={() => setStarted(true)}
        >
          <Play className="h-5 w-5" />
          Iniciar Apresentação
        </Button>
      </div>
    );
  }

  const slide = SLIDES[currentSlide] ?? SLIDES[0];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-8">
      {/* Slide indicator */}
      <div className="absolute left-6 top-6 flex items-center gap-2">
        {SLIDES.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === currentSlide ? "w-8 bg-primary" : "w-2 bg-muted"
            }`}
          />
        ))}
      </div>

      <div className="absolute right-6 top-6 text-xs text-muted-foreground">
        {sessionCode}
      </div>

      {/* Slide content */}
      <div className="slide-transition max-w-3xl text-center" key={currentSlide}>
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary">
          {slide.subtitle}
        </p>
        <h1 className="mb-6 text-5xl font-bold leading-tight text-foreground">
          {slide.title}
        </h1>
        <p className="text-xl leading-relaxed text-muted-foreground">
          {slide.content}
        </p>
      </div>

      {/* Slide number */}
      <div className="absolute bottom-8 text-sm text-muted-foreground">
        {currentSlide + 1} / {SLIDES.length}
      </div>
    </div>
  );
}
