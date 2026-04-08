import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "react-qr-code";
import { Play, Smartphone, Monitor, Upload as UploadIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import FileUploadZone, { type UploadedFile } from "@/components/FileUploadZone";
import FileViewer from "@/components/FileViewer";

const TOTAL_SLIDES = 3;

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

type AppState = "upload" | "choose" | "qr" | "presenting";

export default function Presenter() {
  const [state, setState] = useState<AppState>("upload");
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [linked, setLinked] = useState(false);

  // Handle file upload
  const onFileUploaded = useCallback((f: UploadedFile) => {
    setFile(f);
    setState("choose");
  }, []);

  // Start standalone presentation (no DB)
  const startStandalone = () => {
    setLinked(false);
    setCurrentSlide(0);
    setState("presenting");
  };

  // Create session & show QR
  const startLinked = async () => {
    const code = generateCode();
    const { data, error } = await supabase
      .from("sessions")
      .insert({ session_code: code, status: "waiting" })
      .select()
      .single();

    if (error || !data) {
      console.error("Error creating session:", error);
      return;
    }

    setSessionCode(data.session_code);
    setSessionId(data.id);
    setLinked(true);
    setState("qr");
  };

  // Listen for status change to 'connected' while on QR screen
  useEffect(() => {
    if (state !== "qr" || !sessionId) return;

    const channel = supabase
      .channel(`session-status-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.new.status === "connected") {
            setCurrentSlide(0);
            setState("presenting");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [state, sessionId]);

  // Listen for slide changes during linked presentation
  useEffect(() => {
    if (state !== "presenting" || !linked || !sessionId) return;

    const channel = supabase
      .channel(`session-slide-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          setCurrentSlide(payload.new.current_slide as number);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [state, linked, sessionId]);

  const controlUrl = sessionCode
    ? `${window.location.origin}/controle?code=${sessionCode}`
    : "";

  // ---------- UPLOAD SCREEN ----------
  if (state === "upload") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Monitor className="h-5 w-5" />
          <span className="text-sm font-medium uppercase tracking-widest">
            Playbook Comercial
          </span>
        </div>
        <h1 className="text-3xl font-bold text-foreground">
          Envie sua apresentação
        </h1>
        <FileUploadZone onFileUploaded={onFileUploaded} />
      </div>
    );
  }

  // ---------- CHOOSE MODE SCREEN ----------
  if (state === "choose") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Monitor className="h-5 w-5" />
          <span className="text-sm font-medium uppercase tracking-widest">
            Playbook Comercial
          </span>
        </div>

        {/* File info card */}
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-6 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <UploadIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{file?.file.name}</p>
            <p className="text-sm text-muted-foreground uppercase">{file?.type}</p>
          </div>
          <button
            onClick={() => { setFile(null); setState("upload"); }}
            className="ml-4 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Button
            size="lg"
            className="gap-3 rounded-xl px-8 text-base"
            onClick={startStandalone}
          >
            <Play className="h-5 w-5" />
            Iniciar Apresentação
          </Button>

          <Button
            size="lg"
            variant="secondary"
            className="gap-3 rounded-xl border border-primary/30 px-8 text-base text-primary hover:bg-primary/10"
            onClick={startLinked}
          >
            <Smartphone className="h-5 w-5" />
            Vincular Celular
          </Button>
        </div>
      </div>
    );
  }

  // ---------- QR CODE SCREEN ----------
  if (state === "qr") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Smartphone className="h-5 w-5" />
          <span className="text-sm font-medium uppercase tracking-widest">
            Vincular Controle
          </span>
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
            Código: <span className="text-primary">{sessionCode}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Escaneie o QR Code com seu smartphone para controlar
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
          </span>
          <span className="text-sm text-muted-foreground">Aguardando conexão...</span>
        </div>

        <Button
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => setState("choose")}
        >
          Cancelar
        </Button>
      </div>
    );
  }

  // ---------- PRESENTING SCREEN ----------
  if (!file) return null;

  return (
    <div className="h-screen w-screen">
      <FileViewer
        file={file}
        currentSlide={currentSlide}
        totalSlides={TOTAL_SLIDES}
        onSlideChange={linked ? undefined : setCurrentSlide}
        showControls={!linked}
      />

      {/* Linked mode: show session info */}
      {linked && (
        <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-xl bg-card/80 px-4 py-2 text-sm text-muted-foreground backdrop-blur-sm">
          {currentSlide + 1} / {TOTAL_SLIDES} · Sessão{" "}
          <span className="font-mono text-primary">{sessionCode}</span>
        </div>
      )}
    </div>
  );
}
