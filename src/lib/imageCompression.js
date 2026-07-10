const compressibleImageTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const outputExtensionsByType = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const defaultPhotoCompressionOptions = {
  maxHeight: 1600,
  maxWidth: 1600,
  outputType: "image/jpeg",
  quality: 0.82,
};

export const documentImageCompressionOptions = {
  maxHeight: 1800,
  maxWidth: 1800,
  outputType: "image/jpeg",
  quality: 0.85,
};

export function isImageFile(file) {
  return Boolean(file?.type?.startsWith("image/"));
}

function isCompressibleImageFile(file) {
  if (!isImageFile(file)) {
    return false;
  }

  if (!file.type) {
    return false;
  }

  return compressibleImageTypes.has(file.type.toLowerCase());
}

function getCompressedFileName(fileName, outputType) {
  const extension = outputExtensionsByType[outputType] ?? "jpg";
  const baseName = String(fileName || "image")
    .replace(/[\\/]/g, "-")
    .replace(/\.[^.]+$/, "")
    .trim();

  return `${baseName || "image"}.${extension}`;
}

function getTargetSize(width, height, maxWidth, maxHeight) {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);

  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

function canvasToBlob(canvas, outputType, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, outputType, quality);
  });
}

async function loadImageSource(file) {
  if (typeof window !== "undefined" && "createImageBitmap" in window) {
    try {
      return await window.createImageBitmap(file, {
        imageOrientation: "from-image",
      });
    } catch {
      return window.createImageBitmap(file);
    }
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load image."));
    };
    image.src = objectUrl;
  });
}

export async function compressImageFile(file, options = {}) {
  if (
    !file ||
    !isCompressibleImageFile(file) ||
    typeof document === "undefined"
  ) {
    return file;
  }

  const settings = {
    ...defaultPhotoCompressionOptions,
    ...options,
  };

  try {
    const imageSource = await loadImageSource(file);
    const originalWidth = imageSource.width;
    const originalHeight = imageSource.height;

    if (!originalWidth || !originalHeight) {
      return file;
    }

    const targetSize = getTargetSize(
      originalWidth,
      originalHeight,
      settings.maxWidth,
      settings.maxHeight
    );
    const canvas = document.createElement("canvas");
    canvas.width = targetSize.width;
    canvas.height = targetSize.height;

    const context = canvas.getContext("2d");

    if (!context) {
      return file;
    }

    context.drawImage(imageSource, 0, 0, targetSize.width, targetSize.height);

    if (typeof imageSource.close === "function") {
      imageSource.close();
    }

    const compressedBlob = await canvasToBlob(
      canvas,
      settings.outputType,
      settings.quality
    );

    if (!compressedBlob || compressedBlob.size >= file.size) {
      return file;
    }

    return new File(
      [compressedBlob],
      getCompressedFileName(file.name, settings.outputType),
      {
        lastModified: file.lastModified || Date.now(),
        type: settings.outputType,
      }
    );
  } catch (error) {
    console.warn("Image compression failed; uploading original file.", error);
    return file;
  }
}
