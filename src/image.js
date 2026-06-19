export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('IMAGE_READ_FAILED'));
    reader.readAsDataURL(file);
  });
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'));
    image.src = src;
  });
}

export async function compressImageFile(file, maxSize = 800) {
  const dataUrl = await fileToDataUrl(file);
  const image = await loadImage(dataUrl);

  let { width, height } = image;
  if (width > height && width > maxSize) {
    height = Math.round(height * (maxSize / width));
    width = maxSize;
  } else if (height >= width && height > maxSize) {
    width = Math.round(width * (maxSize / height));
    height = maxSize;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);

  const mimeType = file.type || 'image/jpeg';
  const compressedDataUrl = canvas.toDataURL(mimeType, 0.86);
  return {
    data: compressedDataUrl.split(',')[1],
    mimeType,
    previewUrl: compressedDataUrl,
    name: file.name || 'Ace Lab photo'
  };
}
