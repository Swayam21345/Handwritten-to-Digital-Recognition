/**
 * Image processing service using OpenCV.js (when available) and Canvas API.
 */

export async function preprocessImage(canvas: HTMLCanvasElement): Promise<{
  blob: Blob;
  previewUrl: string;
}> {
  return new Promise((resolve, reject) => {
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not found');

      // 1. Get bounding box of content (Auto-Cropping)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
      let hasPixels = false;

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 10) { // Alpha threshold
          const x = (i / 4) % canvas.width;
          const y = Math.floor((i / 4) / canvas.width);
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          hasPixels = true;
        }
      }

      if (!hasPixels) {
        throw new Error('No content drawn on canvas');
      }

      // Add padding
      const padding = 20;
      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX = Math.min(canvas.width, maxX + padding);
      maxY = Math.min(canvas.height, maxY + padding);

      const width = maxX - minX;
      const height = maxY - minY;

      // 2. Aspect-Ratio Letterboxing (1:1)
      const size = Math.max(width, height);
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = size;
      tempCanvas.height = size;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error('Temp canvas context not found');

      // Center the image
      const dx = (size - width) / 2;
      const dy = (size - height) / 2;
      
      // Black background for the model
      tempCtx.fillStyle = 'black';
      tempCtx.fillRect(0, 0, size, size);
      tempCtx.drawImage(canvas, minX, minY, width, height, dx, dy, width, height);

      // 3. Bilateral Filtering (if OpenCV is available)
      // Note: We simulate this or use canvas filters if CV is not ready
      if (window.cv && window.cv.Mat) {
        try {
          const src = window.cv.imread(tempCanvas);
          const dst = new window.cv.Mat();
          window.cv.cvtColor(src, src, window.cv.COLOR_RGBA2GRAY);
          window.cv.bilateralFilter(src, dst, 9, 75, 75);
          window.cv.imshow(tempCanvas, dst);
          src.delete();
          dst.delete();
        } catch (e) {
          console.warn('OpenCV processing failed, falling back to Canvas', e);
        }
      } else {
        // Fallback: Simple blur to denoise
        tempCtx.filter = 'blur(1px)';
        tempCtx.drawImage(tempCanvas, 0, 0);
      }

      tempCanvas.toBlob((blob) => {
        if (!blob) throw new Error('Blob creation failed');
        resolve({
          blob,
          previewUrl: tempCanvas.toDataURL('image/png'),
        });
      }, 'image/png');

    } catch (error) {
      reject(error);
    }
  });
}

// Global declaration for OpenCV
declare global {
  interface Window {
    cv: any;
  }
}
