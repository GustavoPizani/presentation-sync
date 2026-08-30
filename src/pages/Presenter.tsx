import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import QRCode from "react-qr-code";
import { MessageSquareText, Play, Smartphone, Upload as UploadIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import FileUploadZone, { type UploadedFile } from "@/components/FileUploadZone";
import FileViewer from "@/components/FileViewer";
import { getSlideCount } from "@/lib/slideCount";
import { commentsToMap, parseComments } from "@/lib/parseComments";

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
  const [totalSlides, setTotalSlides] = useState(1);
  const [countingSlides, setCountingSlides] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenRequested, setFullscreenRequested] = useState(false);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [commentsStatus, setCommentsStatus] = useState<string | null>(null);
  const commentsInputRef = useRef<HTMLInputElement>(null);

  // Refs so the (stable) broadcast channel handlers always read fresh values
  // without needing to resubscribe every time file/totalSlides change.
  const fileRef = useRef<UploadedFile | null>(null);
  const totalSlidesRef = useRef(1);
  const commentsRef = useRef<Record<number, string>>({});
  const metaChannelRef = useRef<RealtimeChannel | null>(null);
  fileRef.current = file;
  totalSlidesRef.current = totalSlides;
  commentsRef.current = comments;

  // Parses an uploaded HTML file of per-page comments and pushes it to the
  // connected controller. Kept only in memory for the life of the session —
  // there's no backing DB table for this.
  const uploadComments = useCallback(async (htmlFile: File) => {
    try {
      const text = await htmlFile.text();
      const parsed = parseComments(text);
      const map = commentsToMap(parsed);
      setComments(map);
      commentsRef.current = map;
      metaChannelRef.current?.send({
        type: "broadcast",
        event: "comments",
        payload: { comments: map },
      });
      setCommentsStatus(
        parsed.length > 0
          ? `${parsed.length} comentário(s) carregado(s)`
          : "Nenhum comentário encontrado (use data-page=\"N\" ou id=\"s1\", \"s2\"...)"
      );
    } catch (err) {
      console.error("Error parsing comments file:", err);
      setCommentsStatus("Erro ao ler o arquivo de comentários");
    }
  }, []);

  // Auto-dismiss the comments status toast so it doesn't linger over the
  // slide once the presenter has seen it.
  useEffect(() => {
    if (!commentsStatus) return;
    const t = setTimeout(() => setCommentsStatus(null), 4000);
    return () => clearTimeout(t);
  }, [commentsStatus]);

  const attemptFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => setFullscreenRequested(false))
        .catch(() => {
          // Browsers reject requestFullscreen() unless it's called directly
          // inside a user gesture (click/tap) on this same document. If this
          // was triggered remotely (e.g. from the phone), it fails here —
          // that's an intentional browser security restriction, not a bug.
          // Fall back to asking for a local click to confirm it.
          setFullscreenRequested(true);
        });
    }
  }, []);

  // Remote (phone) fullscreen requests can't force entry — only exit works
  // without a local gesture. For entry, surface a one-tap confirmation here.
  const handleRemoteFullscreenToggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      attemptFullscreen();
    }
  }, [attemptFullscreen]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      attemptFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, [attemptFullscreen]);

  const confirmFullscreenRequest = useCallback(() => {
    attemptFullscreen();
  }, [attemptFullscreen]);

  // Keep local fullscreen state + connected controller in sync with the
  // browser's actual fullscreen status (covers ESC key, manual toggle, etc).
  useEffect(() => {
    const handler = () => {
      const isFs = !!document.fullscreenElement;
      setFullscreen(isFs);
      if (isFs) setFullscreenRequested(false);
      metaChannelRef.current?.send({
        type: "broadcast",
        event: "fullscreen-state",
        payload: { value: isFs },
      });
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Handle file upload
  const onFileUploaded = useCallback((f: UploadedFile) => {
    setFile(f);
    setTotalSlides(1);
    setComments({});
    commentsRef.current = {};
    setCommentsStatus(null);
    setCountingSlides(true);
    getSlideCount(f)
      .then(setTotalSlides)
      .catch((err) => {
        console.error("Error counting slides:", err);
      })
      .finally(() => setCountingSlides(false));
    setState("choose");
  }, []);

  // Start standalone presentation (no DB)
  const startStandalone = () => {
    attemptFullscreen();
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

  // Resume an already-linked session with a newly uploaded file, without
  // creating a new session / QR code, so the phone stays connected.
  const resumeLinkedPresentation = async () => {
    attemptFullscreen();
    setCurrentSlide(0);
    if (sessionId) {
      await supabase.from("sessions").update({ current_slide: 0 }).eq("id", sessionId);
    }
    if (fileRef.current) {
      metaChannelRef.current?.send({
        type: "broadcast",
        event: "meta",
        payload: {
          fileType: fileRef.current.type,
          totalSlides: totalSlidesRef.current,
          comments: commentsRef.current,
        },
      });
    }
    setState("presenting");
  };

  // Exit the presentation. Keeps the linked session (if any) alive so the
  // phone stays connected — going back to upload lets you swap the file
  // without re-scanning the QR code. Tells the phone the show has ended so
  // it can switch to a waiting screen instead of stale/dead controls.
  const exitPresentation = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    metaChannelRef.current?.send({
      type: "broadcast",
      event: "presentation-ended",
      payload: {},
    });
    setFile(null);
    setCurrentSlide(0);
    setState("upload");
  }, []);

  // Broadcast channel for phone <-> browser signaling (file meta, fullscreen
  // requests) that isn't tied to the DB-backed slide position. Kept alive for
  // the whole linked session, independent of which screen is showing.
  useEffect(() => {
    if (!linked || !sessionId) return;

    const channel = supabase.channel(`session-meta-${sessionId}`);
    channel
      .on("broadcast", { event: "request-meta" }, () => {
        if (fileRef.current) {
          channel.send({
            type: "broadcast",
            event: "meta",
            payload: {
              fileType: fileRef.current.type,
              totalSlides: totalSlidesRef.current,
              comments: commentsRef.current,
            },
          });
        }
      })
      .on("broadcast", { event: "fullscreen-toggle" }, () => {
        handleRemoteFullscreenToggle();
      })
      .subscribe();

    metaChannelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      metaChannelRef.current = null;
    };
  }, [linked, sessionId, handleRemoteFullscreenToggle]);

  // Listen for status change to 'connected' while on QR screen. Goes to the
  // "choose" screen (not straight to presenting) so there's a real click
  // here to hang fullscreen off of — browsers refuse requestFullscreen()
  // without one — and so the comments-upload option is reachable before
  // the presentation starts.
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
            setState("choose");
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

  const controlUrl = sessionCode ? `${window.location.origin}/controle?code=${sessionCode}` : "";

  // Shown whenever the phone asked for fullscreen but the browser blocked it
  // (no local user gesture) — one tap here is enough to satisfy that.
  const fullscreenBanner = fullscreenRequested && (
    <button
      onClick={confirmFullscreenRequest}
      className="fixed left-1/2 top-6 z-50 -translate-x-1/2 animate-pulse rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-2xl"
    >
      Celular pediu tela cheia · Toque aqui para confirmar
    </button>
  );

  // Transient feedback for the comments upload, shown over the slide too
  // (fullscreen has no persistent status area to put this in otherwise).
  const commentsToast = commentsStatus && (
    <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-foreground shadow-2xl">
      {commentsStatus}
    </div>
  );

  // ---------- UPLOAD SCREEN ----------
  if (state === "upload") {
    return (
      <>
        {fullscreenBanner}
        <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6">
          <h1 className="text-3xl font-bold text-foreground">
            Envie sua apresentação
          </h1>
          <FileUploadZone onFileUploaded={onFileUploaded} />
          {linked && (
            <p className="text-sm text-muted-foreground">
              Celular continua vinculado · Sessão <span className="font-mono text-primary">{sessionCode}</span>
            </p>
          )}
        </div>
      </>
    );
  }

  // ---------- CHOOSE MODE SCREEN ----------
  if (state === "choose") {
    return (
      <>
      {fullscreenBanner}
      <input
        ref={commentsInputRef}
        type="file"
        accept=".html,.htm"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadComments(f);
          e.target.value = "";
        }}
      />
      <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6">
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

        {linked && (
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="outline"
              className="gap-2 rounded-xl text-sm"
              onClick={() => commentsInputRef.current?.click()}
            >
              <MessageSquareText className="h-4 w-4" />
              Adicionar comentários (HTML)
            </Button>
            {commentsStatus && (
              <p className="text-xs text-muted-foreground">{commentsStatus}</p>
            )}
          </div>
        )}

        {linked ? (
          <Button
            size="lg"
            className="gap-3 rounded-xl px-8 text-base"
            onClick={resumeLinkedPresentation}
            disabled={countingSlides}
          >
            <Play className="h-5 w-5" />
            Continuar Apresentação
          </Button>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button
              size="lg"
              className="gap-3 rounded-xl px-8 text-base"
              onClick={startStandalone}
              disabled={countingSlides}
            >
              <Play className="h-5 w-5" />
              Iniciar Apresentação
            </Button>

            <Button
              size="lg"
              variant="secondary"
              className="gap-3 rounded-xl border border-primary/30 px-8 text-base text-primary hover:bg-primary/10"
              onClick={startLinked}
              disabled={countingSlides}
            >
              <Smartphone className="h-5 w-5" />
              Vincular Celular
            </Button>
          </div>
        )}
      </div>
      </>
    );
  }

  // ---------- QR CODE SCREEN ----------
  if (state === "qr") {
    return (
      <>
      {fullscreenBanner}
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
      </>
    );
  }

  // ---------- PRESENTING SCREEN ----------
  if (!file) return null;

  return (
    <div className="h-screen w-screen">
      {fullscreenBanner}
      {commentsToast}
      <input
        ref={commentsInputRef}
        type="file"
        accept=".html,.htm"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadComments(f);
          e.target.value = "";
        }}
      />
      <FileViewer
        file={file}
        currentSlide={currentSlide}
        totalSlides={totalSlides}
        onSlideChange={linked ? undefined : setCurrentSlide}
        showControls={!linked}
        onExit={exitPresentation}
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
        extraControl={
          linked ? (
            <button
              onClick={() => commentsInputRef.current?.click()}
              className="rounded-lg bg-card/80 p-2 text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
              title="Trocar comentários (HTML)"
            >
              <MessageSquareText className="h-5 w-5" />
            </button>
          ) : undefined
        }
      />
    </div>
  );
}
