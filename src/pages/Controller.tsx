import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, ChevronLeft, Smartphone, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOTAL_SLIDES = 3;

export default function Controller() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  // Find session and mark as connected
  useEffect(() => {
    if (!code) {
      setError("Código de sessão não fornecido.");
      return;
    }

    (async () => {
      const { data, error: err } = await supabase
        .from("sessions")
        .select("id, current_slide")
        .eq("session_code", code.toUpperCase())
        .single();

      if (err || !data) {
        setError("Sessão não encontrada. Verifique o código.");
        return;
      }

      setSessionId(data.id);
      setCurrentSlide(data.current_slide);

      // Mark as connected
      await supabase
        .from("sessions")
        .update({ status: "connected" })
        .eq("id", data.id);

      setConnected(true);
    })();
  }, [code]);

  const updateSlide = useCallback(
    async (newSlide: number) => {
      if (!sessionId) return;
      if (newSlide < 0 || newSlide >= TOTAL_SLIDES) return;

      setCurrentSlide(newSlide);
      await supabase
        .from("sessions")
        .update({ current_slide: newSlide })
        .eq("id", sessionId);
    },
    [sessionId]
  );

  if (error) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6">
        <div className="rounded-2xl border border-destructive/30 bg-card p-6 text-center">
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Conectando...</div>
      </div>
    );
  }

  const isFirst = currentSlide === 0;
  const isLast = currentSlide === TOTAL_SLIDES - 1;

  return (
    <div className="flex min-h-svh flex-col items-center justify-between bg-background px-6 py-8">
      {/* Header */}
      <div className="flex w-full flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Smartphone className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-widest">
            Controle Remoto
          </span>
        </div>
        {connected && (
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
            <Check className="h-3 w-3" />
            Conectado
          </div>
        )}
      </div>

      {/* Slide info */}
      <div className="text-center">
        <p className="text-6xl font-bold text-foreground">{currentSlide + 1}</p>
        <p className="mt-1 text-sm text-muted-foreground">de {TOTAL_SLIDES}</p>
      </div>

      {/* Controls */}
      <div className="flex w-full flex-col gap-4 pb-4">
        <Button
          size="lg"
          disabled={isLast}
          className="h-20 w-full gap-3 rounded-2xl text-xl font-semibold"
          onClick={() => updateSlide(currentSlide + 1)}
        >
          Avançar
          <ChevronRight className="h-7 w-7" />
        </Button>

        <Button
          variant="secondary"
          size="lg"
          disabled={isFirst}
          className="h-14 w-full gap-2 rounded-2xl text-base"
          onClick={() => updateSlide(currentSlide - 1)}
        >
          <ChevronLeft className="h-5 w-5" />
          Voltar
        </Button>
      </div>
    </div>
  );
}
