// Prefer the laptop's built-in camera over phone/virtual cameras.
const GOOD = /integrated|built-?in|internal|facetime|hd webcam|front/i;
const BAD = /iphone|camo|continuity|virtual|obs|phone link|droidcam|ivcam|epoccam|snap camera|ndi|android|ipad/i;

// Returns the preferred videoinput device, or null when there is nothing to choose.
export function preferCamera(devices = []) {
  const cams = devices.filter(d => d && (d.kind ?? "videoinput") === "videoinput");
  if (!cams.length) return null;
  const label = d => d.label || "";
  return cams.find(d => GOOD.test(label(d)) && !BAD.test(label(d)))
    ?? cams.find(d => !BAD.test(label(d)))
    ?? cams[0];
}
