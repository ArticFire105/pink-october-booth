import { validBlobURL } from './cloud-share.js';

const url = validBlobURL(new URLSearchParams(location.search).get('u'));
const image = document.getElementById('download-photo');
const button = document.getElementById('save-photo');
const status = document.getElementById('photo-status');
if (!url) {
  status.textContent = 'This photo link is invalid. Scan a new download QR at the booth.';
} else {
  image.onload = () => {
    image.hidden = button.hidden = false;
    status.textContent = 'Keep a little hope with you.';
  };
  image.onerror = () => {
    image.hidden = button.hidden = true;
    status.textContent = 'This photo is no longer available. Create a new story at the booth.';
  };
  image.src = url;
  button.onclick = async () => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios) {
      status.textContent = 'Touch and hold the image to save it.';
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    button.disabled = true;
    try {
      const response = await fetch(url, { referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error('unavailable');
      const objectURL = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectURL;
      link.download = 'pink-october.png';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectURL), 60000);
      status.textContent = 'Download requested on this device.';
    } catch {
      status.textContent = 'Open the image, then use your browser’s save option.';
      button.textContent = 'Open photo';
      button.onclick = () => window.open(url, '_blank', 'noopener,noreferrer');
    } finally { button.disabled = false; }
  };
}
