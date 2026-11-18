// A photo made small enough to keep with the gym.
//
// Photos of machines are stored inside the gym's own data, so every save sends
// them and every member's app loads them with the map. Straight from a phone
// one is several megabytes; a few filled the browser's storage. At most 800
// pixels on the long side, as a JPEG, one is about a tenth of a megabyte and
// still plenty for a machine's picture.

const MAX_SIDE = 800;
const QUALITY = 0.82;

export const shrinkImage = (file: Blob, maxSide = MAX_SIDE): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Could not read the image.'));
      // A JPEG has no see-through parts: a transparent PNG goes onto white, not black.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', QUALITY));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read the image.')); };
    img.src = url;
  });
