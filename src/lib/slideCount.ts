import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { init } from "pptx-preview";
import type { UploadedFile } from "@/components/FileUploadZone";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function getSlideCount(file: UploadedFile): Promise<number> {
  if (file.type === "html") return 1;

  const buffer = await file.file.arrayBuffer();

  if (file.type === "pdf") {
    const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
    return doc.numPages;
  }

  // pptx
  const container = document.createElement("div");
  const previewer = init(container, { width: 960, height: 540, mode: "slide" });
  await previewer.load(buffer);
  const count = previewer.slideCount ?? 1;
  previewer.destroy();
  return count;
}
