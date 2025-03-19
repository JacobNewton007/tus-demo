import { useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";

const date = new Date();
const timestamp = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;

import "./App.css";

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [upload, setUpload] = useState<tus.Upload | null>(null);
  const fileInputRef = useRef(null);

  // Handle file selection
  const handleFileChange = (e: any) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadStatus("File selected");
      setProgress(0);
    }
  };

  const handleUpload = () => {
    if (!file) {
      setUploadStatus("Please select a file first");
      return;
    }

    if (file) {
      console.log(file.name, "FILENAME >>>>>>>>>>>>")
    }
    setUploadStatus("Starting upload...");

    // Create a new tus upload
    const tusUpload = new tus.Upload(file, {
      endpoint: "http://localhost:3001/api/upload", // This will be proxied to Cloudflare
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: 50 * 1024 * 1024, // 50MB chunk size
      metadata: {
        name: `${timestamp} - ${file.name}`,
        type: file.type,
        allowedorigins: "102.223.38.190"
      },
      onError: (error: { message: any; }) => {
        console.error("Upload error:", error);
        setUploadStatus(`Upload failed: ${error.message}`);
      },
      onProgress: (bytesUploaded: number, bytesTotal: number) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        console.log("percentage: ", percentage);
        setProgress(Number(percentage));
        setUploadStatus(`Uploading: ${percentage}%`);
      },

      onSuccess: () => {
        setUploadStatus('Upload complete! Video is now processing.');
        fetch(`/api/upload/status?filename=${encodeURIComponent(`${timestamp} - ${file.name}`)}`)
          .then(response => response.json())
          .then(data => setMediaId(data.mediaId || ""))
          .catch(err => console.error("Error fetching media ID:", err));
      }
    });

    // Store the upload instance
    setUpload(tusUpload);

    // Start the upload
    tusUpload.start();
  };

  // Handle upload cancellation
  const handleCancel = () => {
    if (upload) {
      upload.abort();
      setUploadStatus("Upload cancelled");
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (upload) {
        upload.abort();
      }
    };
  }, [upload]);

  return (
    <div className="video-uploader">
      <h2>Upload Video to Cloudflare Stream</h2>

      <div className="upload-controls">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="video/*"
          className="file-input"
        />

        <div className="button-group">
          <button
            onClick={handleUpload}
            disabled={!file || (progress > 0 && progress < 100)}
            className="upload-button"
          >
            Upload Video
          </button>

          {progress > 0 && progress < 100 && (
            <button onClick={handleCancel} className="cancel-button">
              Cancel
            </button>
          )}
        </div>
      </div>

      {file && (
        <div className="file-info">
          <p>
            Selected file: <strong>{file.name}</strong>
          </p>
          <p>
            Size: <strong>{(file.size / (1024 * 1024)).toFixed(2)} MB</strong>
          </p>
          <p>
            Type: <strong>{file.type}</strong>
          </p>
        </div>
      )}

      {progress > 0 && (
        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="progress-text">{progress}%</p>
        </div>
      )}

      <p className="status-message">{uploadStatus}</p>

      {mediaId && (
        <div className="media-info">
          <p>
            Media ID: <strong>{mediaId}</strong>
          </p>
          <p>Your video is now being processed by Cloudflare Stream.</p>
        </div>
      )}
    </div>
  );
}

export default App;
