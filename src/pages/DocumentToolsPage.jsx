import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import Icon from "@/components/Icon";

const IMAGE_LIMIT = 20;
const FILE_SIZE_LIMIT = 40 * 1024 * 1024;
const TOTAL_IMAGE_SIZE_LIMIT = 100 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"]);

const TOOLS = [
  { id: "merge", title: "Merge PDF", description: "Gabungkan beberapa PDF menjadi satu file.", icon: "mergePdf", accept: ".pdf,application/pdf", multiple: true },
  { id: "split", title: "Split PDF", description: "Pilih halaman PDF yang ingin dipisahkan.", icon: "splitPdf", accept: ".pdf,application/pdf" },
  { id: "compress", title: "Compress PDF", description: "Perkecil ukuran dengan meraster halaman.", icon: "compressPdf", accept: ".pdf,application/pdf" },
  { id: "image", title: "Image to PDF", description: "Satukan gambar menjadi satu PDF.", icon: "imageFile", accept: "image/jpeg,image/png,image/webp,image/gif,image/bmp", multiple: true },
  { id: "pdf-to-word", title: "PDF to Word", description: "Ekstrak teks PDF ke dokumen Word.", icon: "pdfToWord", accept: ".pdf,application/pdf" },
  { id: "word-to-pdf", title: "Word to PDF", description: "Ubah teks dokumen Word menjadi PDF.", icon: "wordToPdf", accept: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
];

function getBaseName(name) {
  return name.replace(/\.[^.]+$/, "") || "dokumen";
}

function isPdf(file) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isWordDocument(file) {
  return file.name.toLowerCase().endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function isImage(file) {
  return file.type.startsWith("image/");
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  return { blob, name, url };
}

function parsePageRange(value, pageCount) {
  const indexes = [];
  for (const part of value.split(",")) {
    const range = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!range) throw new Error("Format halaman tidak valid. Gunakan contoh 1, 3-5.");
    const start = Number(range[1]);
    const end = Number(range[2] || range[1]);
    if (start < 1 || end < start || end > pageCount) {
      throw new Error(`Nomor halaman harus berada di antara 1 dan ${pageCount}.`);
    }
    for (let page = start; page <= end; page += 1) indexes.push(page - 1);
  }
  if (!indexes.length) throw new Error("Masukkan setidaknya satu halaman.");
  return indexes;
}

function ReorderableList({ items, onReorder, renderItem, className = "", disabled = false }) {
  function moveItem(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || toIndex >= items.length) return;
    const reordered = [...items];
    const [item] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, item);
    onReorder(reordered);
  }

  return (
    <div className={`document-sortable-list ${className}`}>
      {items.map((item, index) => (
        <div
          className="document-sortable-item"
          key={item.id || `${item.name}-${index}`}
          draggable={!disabled}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("application/x-document-file-index", String(index));
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const draggedIndex = event.dataTransfer.getData("application/x-document-file-index");
            if (!draggedIndex) return;
            const fromIndex = Number(draggedIndex);
            moveItem(fromIndex, index);
          }}
        >
          {renderItem(item, index)}
          <div className="document-order-controls" aria-label={`Ubah urutan item ${index + 1}`}>
            <button
              type="button"
              onClick={() => moveItem(index, index - 1)}
              disabled={disabled || index === 0}
              aria-label={`Pindahkan item ${index + 1} ke atas`}
              title="Pindahkan ke atas"
              data-tooltip="Pindahkan ke atas"
            >
              <Icon name="sortUp" size={16} />
            </button>
            <button
              type="button"
              onClick={() => moveItem(index, index + 1)}
              disabled={disabled || index === items.length - 1}
              aria-label={`Pindahkan item ${index + 1} ke bawah`}
              title="Pindahkan ke bawah"
              data-tooltip="Pindahkan ke bawah"
            >
              <Icon name="sortDown" size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function FileDropZone({
  inputRef,
  accept,
  multiple = false,
  title,
  formats,
  compact = false,
  dragging = false,
  disabled = false,
  onFiles,
  onDragStateChange,
}) {
  function handleDrop(event) {
    event.preventDefault();
    onDragStateChange(false);
    if (!disabled) onFiles(Array.from(event.dataTransfer.files || []));
  }

  function handleDragOver(event) {
    event.preventDefault();
    if (!disabled && Array.from(event.dataTransfer.types || []).includes("Files")) {
      onDragStateChange(true);
    }
  }

  return (
    <div
      className={`document-dropzone${compact ? " is-compact" : ""}${dragging ? " is-dragging" : ""}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(event) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onDragStateChange(false);
      }}
      onDrop={handleDrop}
    >
      <span className="document-dropzone-icon"><Icon name="plus" size={compact ? 21 : 24} /></span>
      <strong>{dragging ? "Lepaskan file di sini" : title}</strong>
      {!compact && <span>Seret file ke sini atau klik untuk memilih dari perangkat</span>}
      <span className="document-dropzone-formats">{formats}</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        disabled={disabled}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          event.target.value = "";
          onFiles(files);
        }}
        aria-label={title}
      />
    </div>
  );
}

function DocumentToolsPage() {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const activeTool = TOOLS.some((tool) => tool.id === toolId) ? toolId : "image";
  const [images, setImages] = useState([]);
  const [pdfFiles, setPdfFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState("");
  const [pageRange, setPageRange] = useState("1");
  const [quality, setQuality] = useState(65);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [output, setOutput] = useState(null);
  const [preview, setPreview] = useState(null);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageListRef = useRef(images);
  const previewRequestRef = useRef(0);
  const previousToolRef = useRef(activeTool);
  imageListRef.current = images;

  const currentTool = TOOLS.find((tool) => tool.id === activeTool);
  const activeFile = selectedFiles.find((item) => item.id === activeFileId) || selectedFiles[0] || null;
  const selectedFile = activeFile?.file || null;

  useEffect(() => () => {
    imageListRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  }, []);

  useEffect(() => {
    if (!output) return undefined;
    return () => URL.revokeObjectURL(output.url);
  }, [output]);

  useEffect(() => {
    if (!preview) return undefined;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview?.url]);

  useEffect(() => {
    if (!TOOLS.some((tool) => tool.id === toolId)) {
      navigate("/document-tools/image", { replace: true });
      return;
    }
    if (previousToolRef.current === activeTool) return;
    previousToolRef.current = activeTool;
    closePreview();
    setSelectedFiles([]);
    setActiveFileId("");
    setPdfFiles([]);
    setError("");
    setNotice("");
    setOutput(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [activeTool, navigate, toolId]);

  useEffect(() => {
    if (!preview) return undefined;
    function handlePreviewKeyDown(event) {
      if (event.key === "Escape") closePreview();
    }
    window.addEventListener("keydown", handlePreviewKeyDown);
    return () => window.removeEventListener("keydown", handlePreviewKeyDown);
  }, [preview]);

  useEffect(() => {
    if (activeTool !== "image" || busy) return undefined;
    function handlePaste(event) {
      const clipboardItems = Array.from(event.clipboardData?.items || []);
      const pastedImages = clipboardItems
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter(Boolean);
      if (!pastedImages.length) return;
      event.preventDefault();
      addImages(pastedImages);
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [activeTool, busy, images.length]);

  function addImages(files) {
    const accepted = [];
    const rejected = [];
    let remaining = IMAGE_LIMIT - images.length;
    let remainingBytes = TOTAL_IMAGE_SIZE_LIMIT - images.reduce((total, image) => total + image.file.size, 0);
    for (const file of files) {
      if (!IMAGE_TYPES.has(file.type)) {
        rejected.push(`${file.name}: format gambar tidak didukung`);
      } else if (file.size > FILE_SIZE_LIMIT) {
        rejected.push(`${file.name}: ukuran melebihi 40 MB`);
      } else if (file.size > remainingBytes) {
        rejected.push(`${file.name}: total ukuran gambar maksimal 100 MB`);
      } else if (remaining <= 0) {
        rejected.push(`Maksimal ${IMAGE_LIMIT} gambar per PDF`);
      } else {
        accepted.push({
          id: `${Date.now()}-${Math.random()}`,
          file,
          previewUrl: URL.createObjectURL(file),
          rotation: 0,
        });
        remaining -= 1;
        remainingBytes -= file.size;
      }
    }
    if (accepted.length) {
      setImages((current) => [...current, ...accepted]);
      setError("");
      setNotice(`${accepted.length} gambar ditambahkan. Anda juga dapat menekan Ctrl+V untuk paste gambar.`);
      setOutput(null);
    }
    if (rejected.length) setError(rejected.join(". "));
  }

  function closePreview() {
    previewRequestRef.current += 1;
    setPreview(null);
  }

  async function openFilePreview(file, rotation = 0, rotateTarget = null) {
    closePreview();
    const requestId = previewRequestRef.current;
    const nextPreview = {
      file,
      url: URL.createObjectURL(file),
      rotation,
      rotateTarget,
      loading: isWordDocument(file),
      text: "",
      error: "",
    };
    setPreview(nextPreview);

    if (!isWordDocument(file)) return;
    try {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      if (previewRequestRef.current !== requestId) return;
      setPreview((current) => current?.url === nextPreview.url
        ? { ...current, loading: false, text: value }
        : current);
    } catch (previewError) {
      console.error("Pratinjau dokumen Word gagal dimuat.", previewError);
      if (previewRequestRef.current !== requestId) return;
      setPreview((current) => current?.url === nextPreview.url
        ? { ...current, loading: false, error: "Teks dokumen tidak dapat dibaca untuk pratinjau." }
        : current);
    }
  }

  function removePdfFileById(id) {
    const removed = pdfFiles.find((item) => item.id === id);
    if (preview?.file === removed?.file) closePreview();
    setPdfFiles((current) => current.filter((item) => item.id !== id));
    setOutput(null);
    setNotice("");
  }

  function rotateImage(id) {
    setImages((current) => current.map((image) =>
      image.id === id ? { ...image, rotation: (image.rotation + 90) % 360 } : image
    ));
    setOutput(null);
  }

  function duplicateImage(image) {
    if (images.length >= IMAGE_LIMIT) {
      setError(`Maksimal ${IMAGE_LIMIT} gambar per PDF.`);
      return;
    }
    if (images.reduce((total, item) => total + item.file.size, 0) + image.file.size > TOTAL_IMAGE_SIZE_LIMIT) {
      setError("Total ukuran gambar maksimal 100 MB.");
      return;
    }
    setImages((current) => [...current, {
      ...image,
      id: `${Date.now()}-${Math.random()}`,
      previewUrl: URL.createObjectURL(image.file),
    }]);
    setError("");
    setNotice(`${image.file.name} berhasil diduplikasi.`);
    setOutput(null);
  }

  function rotatePdfFile(id) {
    setPdfFiles((current) => current.map((item) =>
      item.id === id ? { ...item, rotation: (item.rotation + 90) % 360 } : item
    ));
    setOutput(null);
  }

  function clearPdfFiles() {
    if (pdfFiles.some((item) => item.file === preview?.file)) closePreview();
    setPdfFiles([]);
    setOutput(null);
    setError("");
    setNotice("");
  }

  function duplicatePdfFile(item) {
    if (pdfFiles.length >= 20) {
      setError("Maksimal 20 file PDF untuk digabung.");
      return;
    }
    setPdfFiles((current) => [...current, { ...item, id: `${Date.now()}-${Math.random()}` }]);
    setError("");
    setNotice(`${item.file.name} berhasil diduplikasi.`);
    setOutput(null);
  }

  function removeSelectedFileById(id) {
    const removed = selectedFiles.find((item) => item.id === id);
    if (preview?.file === removed?.file) closePreview();
    const remaining = selectedFiles.filter((item) => item.id !== id);
    setSelectedFiles(remaining);
    if (activeFileId === id) setActiveFileId(remaining[0]?.id || "");
    setOutput(null);
    setError("");
    setNotice("");
  }

  function duplicateSelectedFile(item) {
    if (selectedFiles.length >= 20) {
      setError("Maksimal 20 file untuk diproses.");
      return;
    }
    const duplicate = { ...item, id: `${Date.now()}-${Math.random()}` };
    setSelectedFiles((current) => [...current, duplicate]);
    setActiveFileId(duplicate.id);
    setError("");
    setNotice(`${item.file.name} berhasil diduplikasi.`);
    setOutput(null);
  }

  function rotateSelectedFile(id) {
    setSelectedFiles((current) => current.map((item) =>
      item.id === id ? { ...item, rotation: (item.rotation + 90) % 360 } : item
    ));
    setOutput(null);
  }

  function rotatePreview() {
    if (!preview) return;
    const rotation = (preview.rotation + 90) % 360;
    setPreview((current) => current ? { ...current, rotation } : current);
    if (preview.rotateTarget?.type === "image") rotateImage(preview.rotateTarget.id);
    if (preview.rotateTarget?.type === "pdf") rotatePdfFile(preview.rotateTarget.id);
    if (preview.rotateTarget?.type === "single") rotateSelectedFile(preview.rotateTarget.id);
  }

  function handleSelectedFiles(selected) {
    if (busy || !selected.length) return;
    setError("");
    setNotice("");
    setOutput(null);

    if (activeTool === "image") {
      addImages(selected);
      return;
    }

    if (activeTool === "merge") {
      const invalid = selected.find((file) => !isPdf(file) || file.size > FILE_SIZE_LIMIT);
      if (invalid) {
        setError(`${invalid.name}: pilih PDF berukuran maksimal 40 MB.`);
        return;
      }
      if (pdfFiles.length + selected.length > 20) {
        setError("Maksimal 20 file PDF untuk digabung.");
        return;
      }
      setPdfFiles((current) => [...current, ...selected.map((file) => ({
        id: `${Date.now()}-${Math.random()}-${file.name}`,
        file,
        rotation: 0,
      }))]);
      return;
    }

    const isPdfTool = ["split", "compress", "pdf-to-word"].includes(activeTool);
    const invalid = selected.find((file) =>
      file.size > FILE_SIZE_LIMIT ||
      (isPdfTool ? !isPdf(file) : !isWordDocument(file))
    );
    if (invalid) {
      setError(isPdfTool
        ? `${invalid.name}: pilih PDF valid berukuran maksimal 40 MB.`
        : `${invalid.name}: pilih dokumen Word .docx berukuran maksimal 40 MB.`);
      return;
    }
    const newFiles = selected.map((item) => ({ id: `${Date.now()}-${Math.random()}-${item.name}`, file: item, rotation: 0 }));
    if (selectedFiles.length + newFiles.length > 20) {
      setError("Maksimal 20 file untuk diproses.");
      return;
    }
    if (newFiles.length) {
      setSelectedFiles((current) => [...current, ...newFiles]);
      setActiveFileId((current) => current || newFiles[0].id);
      if (activeTool === "split") setPageRange("1");
    }
  }

  function handleFileSelection(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    handleSelectedFiles(selected);
  }

  function removeImage(id) {
    const removed = images.find((image) => image.id === id);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    if (preview?.file === removed?.file) closePreview();
    setImages((current) => current.filter((image) => image.id !== id));
    setOutput(null);
  }

  function reorderImages(reorderedImages) {
    setImages(reorderedImages);
    setOutput(null);
  }

  function reorderPdfFiles(reorderedFiles) {
    setPdfFiles(reorderedFiles);
    setOutput(null);
  }

  function clearImages() {
    images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    if (images.some((image) => image.file === preview?.file)) closePreview();
    setImages([]);
    setError("");
    setNotice("");
    setOutput(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function createImagePdf() {
    if (!images.length) throw new Error("Tambahkan setidaknya satu gambar terlebih dahulu.");
    const { jsPDF } = await import("jspdf");
    let pdf;
    for (let index = 0; index < images.length; index += 1) {
      const bitmap = await createImageBitmap(images[index].file);
      try {
        const canvas = document.createElement("canvas");
        const rotation = images[index].rotation || 0;
        const isQuarterTurn = rotation % 180 !== 0;
        canvas.width = isQuarterTurn ? bitmap.height : bitmap.width;
        canvas.height = isQuarterTurn ? bitmap.width : bitmap.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Browser tidak dapat memproses gambar.");
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.translate(canvas.width / 2, canvas.height / 2);
        context.rotate((rotation * Math.PI) / 180);
        context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
        const orientation = canvas.width > canvas.height ? "landscape" : "portrait";
        if (index === 0) pdf = new jsPDF({ unit: "pt", format: "a4", orientation, compress: true });
        else pdf.addPage("a4", orientation);
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 24;
        const scale = Math.min((pageWidth - margin * 2) / canvas.width, (pageHeight - margin * 2) / canvas.height);
        const width = canvas.width * scale;
        const height = canvas.height * scale;
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", (pageWidth - width) / 2, (pageHeight - height) / 2, width, height);
      } finally {
        bitmap.close();
      }
    }
    return saveBlob(pdf.output("blob"), "gambar-gabungan.pdf");
  }

  async function mergePdfs() {
    if (pdfFiles.length < 2) throw new Error("Pilih setidaknya dua file PDF untuk digabungkan.");
    const { PDFDocument, degrees } = await import("pdf-lib");
    const merged = await PDFDocument.create();
    for (const item of pdfFiles) {
      const { file, rotation } = item;
      const source = await PDFDocument.load(await file.arrayBuffer());
      const pages = await merged.copyPages(source, source.getPageIndices());
      pages.forEach((page) => {
        if (rotation) page.setRotation(degrees((page.getRotation().angle + rotation) % 360));
        merged.addPage(page);
      });
    }
    const bytes = await merged.save({ useObjectStreams: true });
    return saveBlob(new Blob([bytes], { type: "application/pdf" }), "gabungan.pdf");
  }

  async function splitPdf() {
    if (!selectedFile) throw new Error("Pilih file PDF terlebih dahulu.");
    const { PDFDocument, degrees } = await import("pdf-lib");
    const source = await PDFDocument.load(await selectedFile.arrayBuffer());
    const indexes = parsePageRange(pageRange, source.getPageCount());
    const result = await PDFDocument.create();
    const pages = await result.copyPages(source, indexes);
    pages.forEach((page) => {
      if (activeFile.rotation) page.setRotation(degrees((page.getRotation().angle + activeFile.rotation) % 360));
      result.addPage(page);
    });
    const bytes = await result.save({ useObjectStreams: true });
    return saveBlob(new Blob([bytes], { type: "application/pdf" }), `${getBaseName(selectedFile.name)}-halaman.pdf`);
  }

  async function compressPdf() {
    if (!selectedFile) throw new Error("Pilih file PDF terlebih dahulu.");
    const originalBytes = new Uint8Array(await selectedFile.arrayBuffer());
    const [{ jsPDF }, pdfjs] = await Promise.all([
      import("jspdf"),
      import("pdfjs-dist/legacy/build/pdf.mjs"),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const pdfDocument = await pdfjs.getDocument({ data: new Uint8Array(originalBytes) }).promise;
    let pdf;
    try {
      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5, rotation: page.rotate + activeFile.rotation });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Browser tidak dapat memproses halaman PDF.");
        await page.render({ canvasContext: context, viewport, background: "#fff" }).promise;
        const pageWidth = viewport.width / 1.5;
        const pageHeight = viewport.height / 1.5;
        if (pageNumber === 1) pdf = new jsPDF({ unit: "pt", format: [pageWidth, pageHeight], compress: true });
        else pdf.addPage([pageWidth, pageHeight]);
        pdf.addImage(canvas.toDataURL("image/jpeg", quality / 100), "JPEG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
        canvas.width = 0;
        canvas.height = 0;
      }
    } finally {
      await pdfDocument.destroy();
    }
    const rasterizedBlob = pdf.output("blob");
    const reduced = rasterizedBlob.size < originalBytes.byteLength;
    const preserveOriginal = !reduced && activeFile.rotation === 0;
    const blob = preserveOriginal
      ? new Blob([originalBytes], { type: "application/pdf" })
      : rasterizedBlob;
    const percent = Math.max(1, Math.round((1 - blob.size / originalBytes.byteLength) * 100));
    setNotice(reduced
      ? `Ukuran berkurang sekitar ${percent}%. Halaman diraster sehingga teks tidak dapat dipilih.`
      : preserveOriginal
        ? "Rasterisasi akan memperbesar ukuran file, jadi PDF asli dipertahankan tanpa perubahan."
        : "Rotasi diterapkan. Halaman diraster sehingga teks tidak dapat dipilih.");
    return saveBlob(blob, `${getBaseName(selectedFile.name)}-compressed.pdf`);
  }

  async function convertPdfToWord() {
    if (!selectedFile) throw new Error("Pilih file PDF terlebih dahulu.");
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await selectedFile.arrayBuffer()) }).promise;
    const pageTexts = [];
    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        let line = "";
        const lines = [];
        for (const item of content.items) {
          if (!("str" in item)) continue;
          line += `${line ? " " : ""}${item.str}`;
          if (item.hasEOL) {
            lines.push(line);
            line = "";
          }
        }
        if (line) lines.push(line);
        pageTexts.push(lines.join("\n"));
      }
    } finally {
      await pdf.destroy();
    }
    const { Document, Packer, Paragraph, TextRun } = await import("docx");
    const children = [];
    pageTexts.forEach((text, pageIndex) => {
      const lines = text.split(/\r?\n/);
      (lines.length ? lines : [""]).forEach((line, lineIndex) => {
        children.push(new Paragraph({
          pageBreakBefore: pageIndex > 0 && lineIndex === 0,
          children: [new TextRun(line || " ")],
        }));
      });
    });
    const word = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(word);
    setNotice("Teks berhasil diekstrak. Tata letak asli PDF tidak dipertahankan.");
    return saveBlob(blob, `${getBaseName(selectedFile.name)}.docx`);
  }

  async function convertWordToPdf() {
    if (!selectedFile) throw new Error("Pilih dokumen Word terlebih dahulu.");
    const [{ jsPDF }, mammoth] = await Promise.all([
      import("jspdf"),
      import("mammoth"),
    ]);
    const { value: text } = await mammoth.extractRawText({ arrayBuffer: await selectedFile.arrayBuffer() });
    if (!text.trim()) throw new Error("Dokumen Word tidak berisi teks yang dapat dikonversi.");
    const { PDFDocument, degrees } = await import("pdf-lib");
    const pdf = new jsPDF({
      unit: "pt",
      format: "a4",
      orientation: "portrait",
      compress: true,
    });
    const margin = 48;
    const lineHeight = 16;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let y = margin;
    for (const paragraph of text.split(/\r?\n/)) {
      const lines = paragraph ? pdf.splitTextToSize(paragraph, pageWidth - margin * 2) : [""];
      for (const line of lines) {
        if (y + lineHeight > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(line, margin, y);
        y += lineHeight;
      }
      y += 6;
    }
    setNotice("Teks berhasil dikonversi. Gambar dan tata letak asli dokumen Word tidak dipertahankan.");
    const generated = await PDFDocument.load(pdf.output("arraybuffer"));
    if (activeFile.rotation) {
      generated.getPages().forEach((page) => {
        page.setRotation(degrees((page.getRotation().angle + activeFile.rotation) % 360));
      });
    }
    return saveBlob(new Blob([await generated.save()], { type: "application/pdf" }), `${getBaseName(selectedFile.name)}.pdf`);
  }

  async function runCurrentTool() {
    setBusy(true);
    setError("");
    setNotice("");
    setOutput(null);
    try {
      let result;
      if (activeTool === "image") result = await createImagePdf();
      else if (activeTool === "merge") result = await mergePdfs();
      else if (activeTool === "split") result = await splitPdf();
      else if (activeTool === "compress") result = await compressPdf();
      else if (activeTool === "pdf-to-word") result = await convertPdfToWord();
      else result = await convertWordToPdf();
      setOutput(result);
      setNotice((current) => current || "Selesai. File diproses di browser Anda.");
    } catch (conversionError) {
      console.error("Pemrosesan dokumen gagal.", conversionError);
      setError(conversionError.message || "Dokumen tidak dapat diproses. Pastikan format file valid dan coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  const imageDropZone = (
    <FileDropZone
      inputRef={imageInputRef}
      accept={TOOLS.find((tool) => tool.id === "image").accept}
      multiple
      title="Tambah gambar ke PDF"
      formats="JPG, PNG, WebP, GIF, atau BMP · Maks. 40 MB per gambar, 100 MB total"
      compact={images.length > 0}
      dragging={draggingFiles}
      disabled={busy}
      onFiles={handleSelectedFiles}
      onDragStateChange={setDraggingFiles}
    />
  );
  const documentDropZone = (
    <FileDropZone
      inputRef={fileInputRef}
      accept={currentTool.accept}
      multiple={Boolean(currentTool.multiple)}
      title={activeTool === "merge" ? "Tambah file PDF" : "Pilih file untuk diproses"}
      formats={activeTool === "merge"
        ? "File PDF · Maks. 40 MB per file"
        : activeTool === "word-to-pdf"
          ? "Dokumen Word .docx · Maks. 40 MB"
          : "File PDF · Maks. 40 MB"}
      compact={(activeTool === "merge" && pdfFiles.length > 0) || (activeTool !== "merge" && selectedFiles.length > 0)}
      dragging={draggingFiles}
      disabled={busy}
      onFiles={handleSelectedFiles}
      onDragStateChange={setDraggingFiles}
    />
  );

  return (
    <main className="app-shell">
      <AppHeader />
      <div className="page-content document-tools-page">
        <section className="page-intro">
          <div>
            <p className="page-eyebrow"><span />Produktivitas</p>
            <h1>Dokumen <em>Tools.</em></h1>
            <p className="page-subtitle">Kelola PDF dan gambar langsung di browser. File Anda tidak diunggah ke server.</p>
          </div>
        </section>

        <div className="document-tools-workspace">
          <section className="document-tool-panel" aria-labelledby="document-tool-title">
          <div className="document-tool-panel-heading">
            <div>
              <p className="form-kicker">ALAT DOKUMEN</p>
              <h2 id="document-tool-title">{currentTool.title}</h2>
              <p>{currentTool.description}</p>
            </div>
          </div>

          {activeTool === "image" ? (
            images.length === 0 ? imageDropZone : (
              <div className="document-file-board">
                <div className="document-file-list-heading">
                  <strong>{images.length} gambar dipilih</strong>
                  <span className="document-order-hint">Seret kartu untuk mengubah urutan gambar.</span>
                  <button className="document-text-button" type="button" onClick={clearImages} disabled={busy}>Hapus semua</button>
                </div>
                <div className="document-file-board-grid">
                  <ReorderableList
                    className="document-image-grid"
                    items={images}
                    onReorder={reorderImages}
                    disabled={busy}
                    renderItem={(image, index) => (
                      <div className="document-image-item">
                        <img
                          src={image.previewUrl}
                          alt={`Pratinjau gambar ${index + 1}`}
                          style={{ transform: `rotate(${image.rotation}deg)` }}
                        />
                        <div className="document-image-actions">
                          <button type="button" onClick={() => openFilePreview(image.file, image.rotation, { type: "image", id: image.id })} disabled={busy} aria-label={`Pratinjau ${image.file.name}`} title="Lihat pratinjau" data-tooltip="Lihat pratinjau">
                            <Icon name="eye" size={15} />
                          </button>
                          <button type="button" onClick={() => rotateImage(image.id)} disabled={busy} aria-label={`Putar ${image.file.name}`} title="Putar 90° searah jarum jam" data-tooltip="Putar 90°">
                            <Icon name="rotate" size={15} />
                          </button>
                          <button type="button" onClick={() => duplicateImage(image)} disabled={busy} aria-label={`Duplikat ${image.file.name}`} title="Buat salinan file" data-tooltip="Duplikat file">
                            <Icon name="duplicate" size={15} />
                          </button>
                          <button type="button" onClick={() => removeImage(image.id)} disabled={busy} aria-label={`Hapus ${image.file.name}`} title="Hapus file ini" data-tooltip="Hapus file">
                            <Icon name="trash" size={15} />
                          </button>
                        </div>
                        <span title={image.file.name}>{image.file.name}</span>
                      </div>
                    )}
                  />
                  {imageDropZone}
                </div>
                <p className="document-order-hint">Paste gambar dengan Ctrl+V untuk menambahkan langsung dari clipboard.</p>
              </div>
            )
          ) : (
            <>
              {activeTool === "merge" ? (
                pdfFiles.length === 0 ? documentDropZone : (
                  <div className="document-file-board">
                    <div className="document-file-list-heading">
                      <strong>{pdfFiles.length} file PDF dipilih</strong>
                      <span className="document-order-hint">Seret kartu untuk mengubah urutan file.</span>
                      <button className="document-text-button" type="button" onClick={clearPdfFiles} disabled={busy}>Hapus semua</button>
                    </div>
                    <div className="document-file-board-grid">
                      <ReorderableList
                        className="document-pdf-grid"
                        items={pdfFiles}
                        onReorder={reorderPdfFiles}
                        disabled={busy}
                        renderItem={(item, index) => (
                          <div className="document-pdf-card">
                            <button className="document-pdf-cover" type="button" onClick={() => openFilePreview(item.file, item.rotation, { type: "pdf", id: item.id })} disabled={busy} aria-label={`Pratinjau ${item.file.name}`}>
                              <span className="document-pdf-paper document-pdf-paper-back" />
                              <span className="document-pdf-paper document-pdf-paper-front" style={{ transform: `rotate(${item.rotation}deg)` }}>
                                <Icon name="documents" size={31} />
                                <strong>PDF</strong>
                                <span>{index + 1}</span>
                              </span>
                            </button>
                            <div className="document-pdf-card-meta">
                              <span title={item.file.name}>{item.file.name}</span>
                              <small>File PDF · Urutan {index + 1}</small>
                            </div>
                            <div className="document-file-actions">
                              <button type="button" onClick={() => openFilePreview(item.file, item.rotation, { type: "pdf", id: item.id })} disabled={busy} aria-label={`Pratinjau ${item.file.name}`} title="Lihat pratinjau" data-tooltip="Lihat pratinjau">
                                <Icon name="eye" size={15} /> Pratinjau
                              </button>
                              <button type="button" onClick={() => rotatePdfFile(item.id)} disabled={busy} aria-label={`Putar ${item.file.name}`} title="Putar 90° searah jarum jam" data-tooltip="Putar 90°">
                                <Icon name="rotate" size={15} /> Putar
                              </button>
                              <button type="button" onClick={() => duplicatePdfFile(item)} disabled={busy} aria-label={`Duplikat ${item.file.name}`} title="Buat salinan file" data-tooltip="Duplikat file">
                                <Icon name="duplicate" size={15} /> Duplikat
                              </button>
                              <button type="button" onClick={() => removePdfFileById(item.id)} disabled={busy} aria-label={`Hapus ${item.file.name}`} title="Hapus file ini" data-tooltip="Hapus file">
                                <Icon name="trash" size={15} /> Hapus
                              </button>
                            </div>
                          </div>
                        )}
                      />
                      {documentDropZone}
                    </div>
                  </div>
                )
              ) : documentDropZone}
              {activeTool !== "merge" && selectedFiles.length > 0 && (
                <div className="document-file-board">
                  <div className="document-file-list-heading">
                    <strong>{selectedFiles.length} file dipilih</strong>
                    <span className="document-order-hint">Pilih file yang akan diproses.</span>
                  </div>
                  <div className="document-file-board-grid">
                    {selectedFiles.map((item, index) => (
                      <article
                        key={item.id}
                        className={`document-single-file-card${activeFileId === item.id ? " is-active" : ""}`}
                      >
                        <button
                          className="document-pdf-cover"
                          type="button"
                          onClick={() => {
                            setActiveFileId(item.id);
                            void openFilePreview(item.file, item.rotation, { type: "single", id: item.id });
                          }}
                          disabled={busy}
                          aria-label={`Pratinjau ${item.file.name}`}
                          title="Lihat pratinjau"
                          data-tooltip="Lihat pratinjau"
                        >
                          <span className="document-pdf-paper document-pdf-paper-back" />
                          <span className="document-pdf-paper document-pdf-paper-front" style={{ transform: `rotate(${item.rotation}deg)` }}>
                            <Icon name="documents" size={31} />
                            <strong>{isPdf(item.file) ? "PDF" : "WORD"}</strong>
                            <span>{index + 1}</span>
                          </span>
                        </button>
                        <div className="document-pdf-card-meta">
                          <span title={item.file.name}>{item.file.name}</span>
                          <small>{isPdf(item.file) ? "PDF" : "Dokumen Word"} · Rotasi {item.rotation}°</small>
                        </div>
                        <div className="document-file-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveFileId(item.id);
                              void openFilePreview(item.file, item.rotation, { type: "single", id: item.id });
                            }}
                            disabled={busy}
                            aria-label={`Pratinjau ${item.file.name}`}
                            title="Lihat pratinjau"
                            data-tooltip="Lihat pratinjau"
                          >
                            <Icon name="eye" size={15} /> Preview
                          </button>
                          <button type="button" onClick={() => rotateSelectedFile(item.id)} disabled={busy} aria-label={`Putar ${item.file.name}`} title="Putar 90° searah jarum jam" data-tooltip="Putar 90°">
                            <Icon name="rotate" size={15} /> Rotate
                          </button>
                          <button type="button" onClick={() => duplicateSelectedFile(item)} disabled={busy} aria-label={`Duplikat ${item.file.name}`} title="Buat salinan file" data-tooltip="Duplikat file">
                            <Icon name="duplicate" size={15} /> Duplicate
                          </button>
                          <button type="button" onClick={() => removeSelectedFileById(item.id)} disabled={busy} aria-label={`Hapus ${item.file.name}`} title="Hapus file ini" data-tooltip="Hapus file">
                            <Icon name="trash" size={15} /> Delete
                          </button>
                          <button
                            type="button"
                            className="document-select-file-button"
                            onClick={() => setActiveFileId(item.id)}
                            disabled={busy || activeFileId === item.id}
                          >
                            {activeFileId === item.id ? "Dipilih" : "Pilih file"}
                          </button>
                        </div>
                      </article>
                    ))}
                    {documentDropZone}
                  </div>
                  {activeTool === "pdf-to-word" && selectedFile && activeFile.rotation !== 0 && (
                    <p className="document-order-hint">Rotasi PDF digunakan untuk pratinjau; hasil Word berisi teks saja.</p>
                  )}
                  {activeTool === "word-to-pdf" && selectedFile && activeFile.rotation !== 0 && (
                    <p className="document-order-hint">Rotasi dokumen Word diterapkan pada orientasi halaman PDF hasil konversi.</p>
                  )}
                </div>
              )}
              {activeTool === "split" && selectedFile && (
                <label className="document-option-field">
                  <span>Halaman yang akan disimpan</span>
                  <input value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder="Contoh: 1, 3-5" disabled={busy} />
                </label>
              )}
              {activeTool === "compress" && selectedFile && (
                <label className="document-option-field document-quality-field">
                  <span>Kualitas gambar: {quality}%</span>
                  <input type="range" min="35" max="90" value={quality} onChange={(event) => setQuality(Number(event.target.value))} disabled={busy} />
                  <small>Kualitas lebih rendah biasanya menghasilkan file lebih kecil. Halaman akan menjadi gambar.</small>
                </label>
              )}
              {activeTool === "pdf-to-word" && (
                <p className="document-conversion-note">Hanya teks yang dapat diekstrak. Tata letak dan gambar PDF tidak dipertahankan.</p>
              )}
              {activeTool === "word-to-pdf" && (
                <p className="document-conversion-note">Teks akan dikonversi; gambar, tabel, dan tata letak Word tidak dipertahankan.</p>
              )}
            </>
          )}

          {error && <p className="document-message is-error" role="alert">{error}</p>}
          {notice && <p className="document-message" role="status">{notice}</p>}
          {output && (
            <a className="document-download-button" href={output.url} download={output.name}>
              <Icon name="reports" size={17} /> Unduh {output.name}
            </a>
          )}
          <button
            type="button"
            className="document-process-button"
            onClick={runCurrentTool}
            aria-busy={busy}
            disabled={busy || (activeTool === "image" ? images.length === 0 : activeTool === "merge" ? pdfFiles.length < 2 : !selectedFile)}
          >
            {busy ? "Memproses..." : currentTool.title}
          </button>
          <p className="document-privacy-note">Pemrosesan dilakukan secara lokal di browser. Maksimal ukuran file 40 MB.</p>
          </section>
        </div>
      </div>
      <AppFooter />
      {preview && (
        <div className="document-preview-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closePreview();
        }}>
          <section className="document-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="document-preview-title">
            <header className="document-preview-header">
              <div>
                <p className="form-kicker">PRATINJAU FILE</p>
                <h2 id="document-preview-title">{preview.file.name}</h2>
              </div>
              <button type="button" className="document-preview-close" onClick={rotatePreview} aria-label={`Putar pratinjau ${preview.file.name}`} title="Putar pratinjau" data-tooltip="Putar pratinjau">
                <Icon name="rotate" size={18} />
              </button>
              <button type="button" className="document-preview-close" onClick={closePreview} aria-label="Tutup pratinjau" title="Tutup pratinjau" data-tooltip="Tutup pratinjau">
                <Icon name="close" size={20} />
              </button>
            </header>
            <div className="document-preview-content">
              {preview.loading ? (
                <p className="document-preview-state" role="status">Memuat pratinjau dokumen...</p>
              ) : preview.error ? (
                <p className="document-preview-state is-error" role="alert">{preview.error}</p>
              ) : isPdf(preview.file) ? (
                <iframe
                  className="document-preview-pdf"
                  src={preview.url}
                  title={`Pratinjau PDF ${preview.file.name}`}
                  style={{ transform: `rotate(${preview.rotation}deg)` }}
                />
              ) : isImage(preview.file) ? (
                <div className="document-preview-image-wrap">
                  <img
                    className="document-preview-image"
                    src={preview.url}
                    alt={`Pratinjau ${preview.file.name}`}
                    style={{ transform: `rotate(${preview.rotation}deg)` }}
                  />
                </div>
              ) : (
                <>
                  <p className="document-preview-note">Pratinjau teks dari dokumen Word. Tata letak asli tidak ditampilkan.</p>
                  <pre className="document-preview-word" style={{ transform: `rotate(${preview.rotation}deg)` }}>
                    {preview.text || "Dokumen ini tidak memiliki teks yang dapat ditampilkan."}
                  </pre>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default DocumentToolsPage;
