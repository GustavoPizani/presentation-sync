import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ChevronRight, ChevronLeft, Smartphone, Check, X, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ExitConfirmDialog from "@/components/ExitConfirmDialog";

export default function Controller() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const [totalSlides, setTotalSlides] = useState(1);
  // HTML decks manage their own internal slide navigation (via arrow keys
  // forwarded from the presenter), so there's no real page count to clamp to.
  const [isHtml, setIsHtml] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  // Reflects the presenter's browser fullscreen state, not this device's.
  // Browsers block a remote (websocket) message from forcing another
  // document into fullscreen without a real click there, so this is a
  // best-effort request — see the button below.
  const [presenterFullscreen, setPresenterFullscreen] = useState(false);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const metaChannelRef = useRef<RealtimeChannel | null>(null);

  const requestFullscreenToggle = () => {
    metaChannelRef.current?.send({ type: "broadcast", event: "fullscreen-toggle", payload: {} });
  };

  const exitController = () => {
    navigate("/");
  };

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

  // Broadcast channel: ask the presenter what file is currently loaded
  // (type / slide count) and listen for its fullscreen state, since the
  // presenter may swap files without a new QR code / session.
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase.channel(`session-meta-${sessionId}`);
    channel
      .on("broadcast", { event: "meta" }, ({ payload }) => {
        setIsHtml(payload.fileType === "html");
        setTotalSlides(Math.max(1, payload.totalSlides || 1));
        setComments(payload.comments || {});
      })
      .on("broadcast", { event: "comments" }, ({ payload }) => {
        setComments(payload.comments || {});
      })
      .on("broadcast", { event: "fullscreen-state" }, ({ payload }) => {
        setPresenterFullscreen(!!payload.value);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({ type: "broadcast", event: "request-meta", payload: {} });
        }
      });

    metaChannelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      metaChannelRef.current = null;
    };
  }, [sessionId]);

  const updateSlide = useCallback(
    async (newSlide: number) => {
      if (!sessionId) return;
      if (!isHtml && (newSlide < 0 || newSlide >= totalSlides)) return;

      setCurrentSlide(newSlide);
      await supabase
        .from("sessions")
        .update({ current_slide: newSlide })
        .eq("id", sessionId);
    },
    [sessionId, totalSlides, isHtml]
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

  const isFirst = !isHtml && currentSlide === 0;
  const isLast = !isHtml && currentSlide === totalSlides - 1;

  return (
    <div className="flex min-h-svh flex-col items-center justify-between bg-background px-6 py-8">
      {/* Header */}
      <div className="flex w-full items-start justify-between">
        <button
          onClick={() => setConfirmExitOpen(true)}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Sair"
        >
          <X className="h-5 w-5" />
        </button>
        <ExitConfirmDialog
          open={confirmExitOpen}
          onOpenChange={setConfirmExitOpen}
          onConfirm={exitController}
          description="Você sai do controle remoto. O notebook continua apresentando normalmente."
        />

        <div className="flex flex-col items-center gap-2">
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

        <button
          onClick={requestFullscreenToggle}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={presenterFullscreen ? "Sair da tela cheia (notebook)" : "Tela cheia (notebook)"}
        >
          {presenterFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>
      </div>

      {/* Slide info + comment (scrollable so long comments don't push the buttons) */}
      <div className="flex w-full flex-1 flex-col items-center gap-4 overflow-y-auto py-2">
        <div className="text-center">
          <p className="text-6xl font-bold text-foreground">{currentSlide + 1}</p>
          {isHtml ? (
            <p className="mt-1 text-sm text-muted-foreground">Navegação livre</p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">de {totalSlides}</p>
          )}
        </div>

        {comments[currentSlide + 1] && (
          <div className="w-full whitespace-pre-wrap rounded-2xl border border-border bg-card p-4 text-sm text-foreground">
            {comments[currentSlide + 1]}
          </div>
        )}
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
