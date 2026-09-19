"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface UploadSuccessData {
  noteId: string;
  jobId: string;
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<UploadSuccessData | null>(null);

  function validateAndSetFile(candidate: File) {
    setError(null);
    setSuccess(null);

    if (!ALLOWED_MIME_TYPES.includes(candidate.type)) {
      setError("Unsupported file type. Please select a JPEG, PNG, or WebP image.");
      return false;
    }

    if (candidate.size > MAX_FILE_SIZE_BYTES) {
      setError("File is too large. Maximum allowed size is 5MB.");
      return false;
    }

    setFile(candidate);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(candidate));
    return true;
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      validateAndSetFile(selected);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  }

  function handleClearFile() {
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          setError("Your session has expired or you are not signed in. Redirecting to login...");
          setTimeout(() => router.push("/login"), 1500);
          return;
        }
        if (res.status === 429) {
          setError(data.error ?? "Too many uploads. Please wait a moment and try again.");
          return;
        }
        setError(data.error ?? "Upload failed. Please try again.");
        return;
      }

      setSuccess({
        noteId: data.noteId,
        jobId: data.jobId,
      });
      handleClearFile();
    } catch {
      setError("A network error occurred. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-[var(--spacing-xl)] py-[var(--spacing-2xl)]">
      {/* Navigation Header */}
      <div className="mb-[var(--spacing-xl)] flex items-center justify-between">
        <Link
          href="/dashboard"
          className="type-label-large2 flex items-center gap-[var(--spacing-xs)] text-on-surface-variant transition-colors hover:text-primary"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      {/* Main Card */}
      <div
        className="rounded-lg bg-surface-container-lowest p-[var(--spacing-2xl)]"
        style={{ boxShadow: "var(--shadow-soft-shadow)" }}
      >
        <h1 className="type-headline-medium2 mb-[var(--spacing-xs)] text-on-surface">
          Upload a Handwritten Note
        </h1>
        <p className="type-body-medium2 mb-[var(--spacing-xl)] text-on-surface-variant">
          Upload a photo of your handwritten notes to automatically extract titles, key points,
          action items, and dates.
        </p>

        {/* Success Banner */}
        {success ? (
          <div className="flex flex-col gap-[var(--spacing-lg)] rounded-lg border border-outline-variant bg-surface-container-low p-[var(--spacing-xl)]">
            <div className="flex items-start gap-[var(--spacing-base)]">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                <svg
                  className="h-6 w-6 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div className="flex flex-col gap-[var(--spacing-xs)]">
                <h2 className="type-title-large2 text-on-surface">Upload Successful!</h2>
                <p className="type-body-medium2 text-on-surface-variant">
                  Your note has been uploaded and queued for AI extraction.
                </p>
                <div className="mt-[var(--spacing-xs)] flex flex-wrap gap-[var(--spacing-sm)]">
                  <span className="type-label-small2 rounded-full bg-surface-container px-[var(--spacing-sm)] py-[var(--spacing-xs)] text-on-surface-variant">
                    Note ID: {success.noteId.slice(0, 12)}…
                  </span>
                  <span className="type-label-small2 rounded-full bg-primary-container px-[var(--spacing-sm)] py-[var(--spacing-xs)] text-on-primary-container">
                    Status: Pending Extraction
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-[var(--spacing-base)] pt-[var(--spacing-xs)]">
              <Link
                href="/dashboard"
                className="type-button2 rounded-md bg-primary px-[var(--spacing-base)] py-[var(--spacing-sm)] text-white transition-colors hover:bg-secondary"
              >
                View in Dashboard
              </Link>
              <button
                type="button"
                onClick={() => setSuccess(null)}
                className="type-button2 rounded-md border border-outline px-[var(--spacing-base)] py-[var(--spacing-sm)] text-on-surface transition-colors hover:bg-surface-container"
              >
                Upload another note
              </button>
            </div>
          </div>
        ) : (
          /* Upload Form */
          <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--spacing-xl)]">
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
              id="note-file-input"
            />

            {/* Dropzone Area */}
            {!file ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-[var(--spacing-2xl)] text-center transition-all ${
                  isDragging
                    ? "border-primary bg-primary-container/20"
                    : "border-outline bg-surface-container-low hover:border-primary hover:bg-surface-container"
                }`}
              >
                <div className="mb-[var(--spacing-base)] flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-primary">
                  <svg
                    className="h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.75}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <p className="type-label-large2 text-on-surface">
                  Drag and drop your note photo here, or{" "}
                  <span className="text-primary underline">browse</span>
                </p>
                <p className="type-body-small2 mt-[var(--spacing-xs)] text-on-surface-variant">
                  Supports JPEG, PNG, or WebP (up to 5MB)
                </p>
              </div>
            ) : (
              /* Selected File Preview Card */
              <div className="flex flex-col gap-[var(--spacing-base)] rounded-lg border border-outline-variant bg-surface-container-low p-[var(--spacing-base)]">
                <div className="flex items-center gap-[var(--spacing-base)]">
                  {previewUrl ? (
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-outline-variant bg-surface-container">
                      <img
                        src={previewUrl}
                        alt="Preview of uploaded note"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-md bg-surface-container text-on-surface-variant">
                      <svg
                        className="h-8 w-8"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="type-label-large2 truncate text-on-surface" title={file.name}>
                      {file.name}
                    </p>
                    <p className="type-body-small2 text-on-surface-variant">
                      {formatFileSize(file.size)} • {file.type || "Image"}
                    </p>
                  </div>

                  <div className="flex items-center gap-[var(--spacing-sm)]">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      className="type-button2 rounded-md border border-outline px-[var(--spacing-sm)] py-[var(--spacing-xs)] text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={handleClearFile}
                      disabled={loading}
                      aria-label="Remove selected file"
                      className="rounded-md p-[var(--spacing-xs)] text-on-surface-variant transition-colors hover:bg-surface-container hover:text-error disabled:opacity-50"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-md border border-error bg-error-container/20 p-[var(--spacing-md)]">
                <p className="type-body-small2 text-error">{error}</p>
              </div>
            )}

            {/* Submit Action */}
            <div className="flex items-center justify-end gap-[var(--spacing-base)]">
              <Link
                href="/dashboard"
                className="type-button2 rounded-md border border-outline px-[var(--spacing-base)] py-[var(--spacing-sm)] text-on-surface transition-colors hover:bg-surface-container"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={!file || loading}
                className="type-button2 flex items-center justify-center gap-[var(--spacing-sm)] rounded-md bg-primary px-[var(--spacing-base)] py-[var(--spacing-sm)] text-white transition-colors hover:bg-secondary disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    <span>Uploading…</span>
                  </>
                ) : (
                  <span>Upload note</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
