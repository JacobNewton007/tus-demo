/*
Great, let me dive deeper into the implementation details for connecting your React frontend with the tus server-side upload to Cloudflare Stream.

There are a few key aspects to understand:

## 1. Server-side Proxy Setup

The most important part of the architecture is setting up a proper proxy server. Here's a more detailed Express implementation:

```javascript
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Enable CORS
app.use(cors());

// Set up the proxy middleware for tus uploads
const tusProxy = createProxyMiddleware({
  target: 'https://api.cloudflare.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/upload': `/client/v4/accounts/<ACCOUNT_ID>/stream` // Replace with your account ID
  },
  onProxyReq: (proxyReq) => {
    // Add authentication headers
    proxyReq.setHeader('Authorization', 'Bearer <API_TOKEN>');
  },
  onProxyRes: (proxyRes, req, res) => {
    // Forward the stream-media-id header if present
    const mediaIdHeader = proxyRes.headers['stream-media-id'];
    if (mediaIdHeader) {
      res.setHeader('stream-media-id', mediaIdHeader);
    }
  }
});

// Apply the proxy middleware to all requests to /api/upload
app.use('/api/upload', tusProxy);

app.listen(3001, () => {
  console.log('Server running on port 3001');
});
```

This setup uses `http-proxy-middleware` to forward requests from your React app to Cloudflare while handling authentication securely.

## 2. Frontend Implementation Details

The React component needs to handle:

1. File selection
2. Upload initialization
3. Progress tracking
4. Error handling
5. Completion notification

Here's a more detailed explanation of the React component:

```jsx
import { useRef, useState, useEffect } from 'react';
import * as tus from 'tus-js-client';

function VideoUploader() {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [mediaId, setMediaId] = useState('');
  const [upload, setUpload] = useState(null);
  const fileInputRef = useRef(null);

  // Handle file selection
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadStatus('File selected');
      setProgress(0);
    }
  };

  // Initialize the upload
  const handleUpload = () => {
    if (!file) {
      setUploadStatus('Please select a file first');
      return;
    }

    setUploadStatus('Starting upload...');
    
    // Create a new tus upload
    const tusUpload = new tus.Upload(file, {
      endpoint: '/api/upload', // This will be proxied to Cloudflare
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: 50 * 1024 * 1024, // 50MB chunk size
      metadata: {
        filename: file.name,
        filetype: file.type
      },
      onError: (error) => {
        console.error('Upload error:', error);
        setUploadStatus(`Upload failed: ${error.message}`);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        setProgress(percentage);
        setUploadStatus(`Uploading: ${percentage}%`);
      },
      onSuccess: () => {
        setUploadStatus('Upload complete!');
        console.log('Upload finished', mediaId);
      },
      onAfterResponse: (req, res) => {
        return new Promise((resolve) => {
          const mediaIdHeader = res.getHeader('stream-media-id');
          if (mediaIdHeader) {
            setMediaId(mediaIdHeader);
          }
          resolve();
        });
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
      setUploadStatus('Upload cancelled');
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
            disabled={!file || progress > 0 && progress < 100}
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
          <p>Selected file: <strong>{file.name}</strong></p>
          <p>Size: <strong>{(file.size / (1024 * 1024)).toFixed(2)} MB</strong></p>
          <p>Type: <strong>{file.type}</strong></p>
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
          <p>Media ID: <strong>{mediaId}</strong></p>
          <p>Your video is now being processed by Cloudflare Stream.</p>
        </div>
      )}
    </div>
  );
}

export default VideoUploader;
```

## 3. How They Work Together

Here's the full flow:

1. The user selects a video file in the React application
2. When they click "Upload", the tus client in the React app initializes the upload
3. The tus client sends the upload request to your server endpoint `/api/upload`
4. Your server proxy forwards the request to Cloudflare, adding the necessary authentication headers
5. Cloudflare processes the upload and returns responses including the media ID
6. The tus client in the React app handles chunking, resumability, and progress tracking
7. When the upload is complete, the media ID is displayed to the user

## 4. Benefits of This Approach

- Security: Your Cloudflare API credentials are never exposed to the client
- Resumability: The tus protocol handles interrupted uploads automatically
- Progress tracking: Users can see real-time upload progress
- Cancellation: Users can cancel uploads if needed
- Error handling: Comprehensive error handling is provided

## 5. Additional Considerations

- Environment variables: Store your Cloudflare API token and account ID as environment variables
- Rate limiting: Implement rate limiting on your server to prevent abuse
- File size validation: Validate file sizes before initiating uploads
- File type validation: Restrict uploads to supported video formats
- Error logging: Implement proper error logging for troubleshooting

Is there a specific part of this implementation you'd like me to elaborate on further?Great, let me dive deeper into the implementation details for connecting your React frontend with the tus server-side upload to Cloudflare Stream.

There are a few key aspects to understand:

## 1. Server-side Proxy Setup

The most important part of the architecture is setting up a proper proxy server. Here's a more detailed Express implementation:

```javascript
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Enable CORS
app.use(cors());

// Set up the proxy middleware for tus uploads
const tusProxy = createProxyMiddleware({
  target: 'https://api.cloudflare.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/upload': `/client/v4/accounts/<ACCOUNT_ID>/stream` // Replace with your account ID
  },
  onProxyReq: (proxyReq) => {
    // Add authentication headers
    proxyReq.setHeader('Authorization', 'Bearer <API_TOKEN>');
  },
  onProxyRes: (proxyRes, req, res) => {
    // Forward the stream-media-id header if present
    const mediaIdHeader = proxyRes.headers['stream-media-id'];
    if (mediaIdHeader) {
      res.setHeader('stream-media-id', mediaIdHeader);
    }
  }
});

// Apply the proxy middleware to all requests to /api/upload
app.use('/api/upload', tusProxy);

app.listen(3001, () => {
  console.log('Server running on port 3001');
});
```

This setup uses `http-proxy-middleware` to forward requests from your React app to Cloudflare while handling authentication securely.

## 2. Frontend Implementation Details

The React component needs to handle:

1. File selection
2. Upload initialization
3. Progress tracking
4. Error handling
5. Completion notification

Here's a more detailed explanation of the React component:

```jsx
import { useRef, useState, useEffect } from 'react';
import * as tus from 'tus-js-client';

function VideoUploader() {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [mediaId, setMediaId] = useState('');
  const [upload, setUpload] = useState(null);
  const fileInputRef = useRef(null);

  // Handle file selection
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadStatus('File selected');
      setProgress(0);
    }
  };

  // Initialize the upload
  const handleUpload = () => {
    if (!file) {
      setUploadStatus('Please select a file first');
      return;
    }

    setUploadStatus('Starting upload...');
    
    // Create a new tus upload
    const tusUpload = new tus.Upload(file, {
      endpoint: '/api/upload', // This will be proxied to Cloudflare
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: 50 * 1024 * 1024, // 50MB chunk size
      metadata: {
        filename: file.name,
        filetype: file.type
      },
      onError: (error) => {
        console.error('Upload error:', error);
        setUploadStatus(`Upload failed: ${error.message}`);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        setProgress(percentage);
        setUploadStatus(`Uploading: ${percentage}%`);
      },
      onSuccess: () => {
        setUploadStatus('Upload complete!');
        console.log('Upload finished', mediaId);
      },
      onAfterResponse: (req, res) => {
        return new Promise((resolve) => {
          const mediaIdHeader = res.getHeader('stream-media-id');
          if (mediaIdHeader) {
            setMediaId(mediaIdHeader);
          }
          resolve();
        });
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
      setUploadStatus('Upload cancelled');
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
            disabled={!file || progress > 0 && progress < 100}
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
          <p>Selected file: <strong>{file.name}</strong></p>
          <p>Size: <strong>{(file.size / (1024 * 1024)).toFixed(2)} MB</strong></p>
          <p>Type: <strong>{file.type}</strong></p>
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
          <p>Media ID: <strong>{mediaId}</strong></p>
          <p>Your video is now being processed by Cloudflare Stream.</p>
        </div>
      )}
    </div>
  );
}

export default VideoUploader;
```

## 3. How They Work Together

Here's the full flow:

1. The user selects a video file in the React application
2. When they click "Upload", the tus client in the React app initializes the upload
3. The tus client sends the upload request to your server endpoint `/api/upload`
4. Your server proxy forwards the request to Cloudflare, adding the necessary authentication headers
5. Cloudflare processes the upload and returns responses including the media ID
6. The tus client in the React app handles chunking, resumability, and progress tracking
7. When the upload is complete, the media ID is displayed to the user

## 4. Benefits of This Approach

- Security: Your Cloudflare API credentials are never exposed to the client
- Resumability: The tus protocol handles interrupted uploads automatically
- Progress tracking: Users can see real-time upload progress
- Cancellation: Users can cancel uploads if needed
- Error handling: Comprehensive error handling is provided

## 5. Additional Considerations

- Environment variables: Store your Cloudflare API token and account ID as environment variables
- Rate limiting: Implement rate limiting on your server to prevent abuse
- File size validation: Validate file sizes before initiating uploads
- File type validation: Restrict uploads to supported video formats
- Error logging: Implement proper error logging for troubleshooting

Is there a specific part of this implementation you'd like me to elaborate on further?
*/
