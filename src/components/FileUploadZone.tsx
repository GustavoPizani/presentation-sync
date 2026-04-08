import { useCallback, useState, useRef } from "react";
import { Upload, FileText, FileImage, Globe } from "lucide-react";

export type UploadedFile = {
  file: File;
  type: "pdf" | "pptx" | "html";
  url: string;
};

function getFileType(file: File): UploadedFile["type"] | null {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "pptx" || ext === "ppt") return "pptx";
  if (ext === "html" || ext === "htm") return "html";
  return null;
}

const ICON_MAP = {
  pdf: FileText,
  pptx: FileImage,
  html: Globe,
};

interface FileUploadZoneProps {
  onFileUploaded: (file: UploadedFile) => void;
}

export default function FileUploadZone({ onFileUploaded }: FileUploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      const type = getFileType(file);
      if (!type) {
        setError("Formato não suportado. Use PDF, PPTX ou HTML.");
        return;
      }
      setError(null);
      const url = URL.createObjectURL(file);
      onFileUploaded({ file, type, url });
    },
    [onFileUploaded]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  return (
    <div className="w-full max-w-xl">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed p-12 transition-all duration-300 ${
          dragging
            ? "border-primary bg-primary/10 scale-[1.02]"
            : "border-border bg-card hover:border-primary/50 hover:bg-card/80"
        }`}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Upload className="h-8 w-8 text-primary" />
        </div>

        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">
            Arraste seu arquivo aqui
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            ou clique para selecionar
          </p>
        </div>

        <div className="flex gap-3">
          {(["pdf", "pptx", "html"] as const).map((t) => {
            const Icon = ICON_MAP[t];
            return (
              <span
                key={t}
                className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium uppercase text-muted-foreground"
              >
                <Icon className="h-3.5 w-3.5" />
                {t}
              </span>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="mt-3 text-center text-sm text-destructive">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.pptx,.ppt,.html,.htm"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
