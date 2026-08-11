import { useEffect, useState, type ChangeEvent } from "react";

import type { MediaNode } from "../types/story";

interface PendingPreviewProps {
  file: File;
  onRemove: () => void;
}

const PendingPreview = ({ file, onRemove }: PendingPreviewProps) => {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="media-tile">
      {previewUrl && <img src={previewUrl} alt={file.name} />}
      <span title={file.name}>{file.name}</span>
      <button type="button" className="remove-media" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
};

interface MediaPickerProps {
  disabled?: boolean;
  existingMedia: MediaNode[];
  imageUrl: (media: MediaNode) => string;
  onError: (message: string) => void;
  onExistingMediaChange: (media: MediaNode[]) => void;
  onPendingFilesChange: (files: File[]) => void;
  pendingFiles: File[];
}

export const MediaPicker = ({
  disabled = false,
  existingMedia,
  imageUrl,
  onError,
  onExistingMediaChange,
  onPendingFilesChange,
  pendingFiles,
}: MediaPickerProps) => {
  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files ?? []);
    const invalid = incoming.filter(
      (file) => file.type !== "image/jpeg" && file.type !== "image/png",
    );
    if (invalid.length) {
      onError("Only JPG and PNG images can be uploaded.");
    }

    const valid = incoming.filter(
      (file) => file.type === "image/jpeg" || file.type === "image/png",
    );
    const keys = new Set(
      pendingFiles.map((file) => `${file.name}:${file.size}:${file.lastModified}`),
    );
    const unique = valid.filter(
      (file) => !keys.has(`${file.name}:${file.size}:${file.lastModified}`),
    );
    onPendingFilesChange([...pendingFiles, ...unique]);
    event.target.value = "";
  };

  return (
    <div className="media-picker">
      <div className="field-heading">
        <div>
          <label htmlFor="story-media">Story media</label>
          <p>Optional. JPG and PNG files are uploaded when the Story is submitted.</p>
        </div>
        <label className={`file-button ${disabled ? "disabled" : ""}`}>
          Add images
          <input
            id="story-media"
            type="file"
            accept="image/jpeg,image/png"
            multiple
            disabled={disabled}
            onChange={handleFiles}
          />
        </label>
      </div>

      {existingMedia.length === 0 && pendingFiles.length === 0 ? (
        <div className="empty-media">No media selected.</div>
      ) : (
        <div className="media-grid">
          {existingMedia.map((media) => {
            const url = imageUrl(media);
            return (
              <div className="media-tile" key={media.guid}>
                {url ? <img src={url} alt={media.guid} /> : <div className="image-fallback">Image</div>}
                <span title={media.guid}>{media.guid}</span>
                <button
                  type="button"
                  className="remove-media"
                  disabled={disabled}
                  onClick={() =>
                    onExistingMediaChange(
                      existingMedia.filter((item) => item.guid !== media.guid),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            );
          })}

          {pendingFiles.map((file, index) => (
            <PendingPreview
              key={`${file.name}:${file.size}:${file.lastModified}`}
              file={file}
              onRemove={() =>
                onPendingFilesChange(
                  pendingFiles.filter((_, fileIndex) => fileIndex !== index),
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};
