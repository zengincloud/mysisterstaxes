"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UploadResult {
  success: boolean;
  imported?: number;
  flagged?: number;
  message?: string;
  error?: string;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = ".csv,.pdf,.png,.jpg,.jpeg";

  const handleFile = useCallback((f: File) => {
    const name = f.name.toLowerCase();
    const valid =
      name.endsWith(".csv") ||
      name.endsWith(".pdf") ||
      name.endsWith(".png") ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg");
    if (!valid) {
      setResult({ success: false, error: "Unsupported file type. Upload CSV, PDF, or image files." });
      return;
    }
    setFile(f);
    setResult(null);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data: UploadResult = await res.json();
      setResult(data);
      if (data.success) setFile(null);
    } catch {
      setResult({ success: false, error: "Upload failed. Please try again." });
    } finally {
      setUploading(false);
    }
  }

  function removeFile() {
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-1">Upload Statements</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Upload bank statements, credit card statements, or receipts. We&apos;ll
        use AI to extract and categorize every transaction automatically.
      </p>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !file && inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer",
          dragging
            ? "border-primary bg-primary/5"
            : file
              ? "border-muted bg-muted/30 cursor-default"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div className="text-left">
              <p className="font-medium text-sm">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeFile();
              }}
              className="ml-2 p-1 rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium mb-1">
              Drop your file here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              CSV, PDF, PNG, or JPG — bank statements, credit card statements, receipts
            </p>
          </>
        )}
      </div>

      {/* Upload button */}
      {file && (
        <div className="mt-4 flex justify-end">
          <Button onClick={handleUpload} disabled={uploading} size="lg">
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Parsing with AI...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload &amp; Parse
              </>
            )}
          </Button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={cn(
            "mt-6 rounded-lg border p-4 flex items-start gap-3",
            result.success
              ? "bg-emerald-50 border-emerald-200"
              : "bg-red-50 border-red-200"
          )}
        >
          {result.success ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          )}
          <div>
            <p
              className={cn(
                "text-sm font-medium",
                result.success ? "text-emerald-800" : "text-red-800"
              )}
            >
              {result.success ? "Upload successful" : "Upload failed"}
            </p>
            <p
              className={cn(
                "text-sm mt-0.5",
                result.success ? "text-emerald-700" : "text-red-700"
              )}
            >
              {result.message || result.error}
            </p>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="mt-8 bg-muted/40 rounded-lg p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Tips for best results
        </p>
        <ul className="text-sm text-muted-foreground space-y-1.5">
          <li>• CSV exports from your bank tend to work the best</li>
          <li>• PDF statements should be text-based (not scanned images)</li>
          <li>• For scanned receipts, take a clear photo with good lighting</li>
          <li>• Transactions are auto-categorized — review flagged items in the Journal</li>
        </ul>
      </div>
    </div>
  );
}
