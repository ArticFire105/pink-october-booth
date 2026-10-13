import { uploadImage } from "./cloud-share.js";
import { paintQR, qrMatrix } from "./story-qr.js";
import { FACT, SOURCE, renderStory, pngBlob, shareStory } from "./story.js";

export function createResultScreen({ onPhoto, onHome, onExport = () => {},
  upload = uploadImage, schedule = setTimeout, cancel = clearTimeout }) {
  const get = id => document.getElementById(id);
  const panel = get("result");
  const preview = get("story-preview");
  const status = get("story-status");
  const share = get("story-share");
  const download = get("story-download");
  let result = null, storyOpen = false, file = null, url = "", generation = 0;
  get("result-fact").textContent = FACT;
  get("result-source").href = SOURCE;

  let timeout;
  function stopTimeout() { cancel(timeout); }
  function restartTimeout() {
    stopTimeout();
    timeout = schedule(onHome, 45000);
  }
  get("result-more-time").onclick = restartTimeout;

  function invalidate() {
    generation += 1;
    get("download-qr").hidden = true;
    if (url) URL.revokeObjectURL(url);
    url = "";
    file = null;
    preview.removeAttribute("src");
    preview.hidden = true;
    share.disabled = download.disabled = true;
  }
  async function generate() {
    invalidate();
    const token = generation;
    status.textContent = "Creating your story…";
    status.focus();
    try {
      const canvas = renderStory(document.createElement("canvas"), result);
      const blob = await pngBlob(canvas);
      if (token !== generation) return;
      file = new File([blob], "gdg-pink-october.png", { type: "image/png" });
      url = URL.createObjectURL(blob);
      preview.src = url;
      preview.hidden = false;
      share.disabled = download.disabled = false;
      status.textContent = "Your story is ready.";
      void upload(blob).then(downloadURL => {
        if (token !== generation || !downloadURL) return;
        const qr = get("download-qr-canvas");
        qr.width = qr.height = (qrMatrix(downloadURL).length + 8) * 10;
        const ctx = qr.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        paintQR(ctx, downloadURL, 0, 0, 10, { light: "#FFFFFF", dark: "#000000" });
        get("download-qr").hidden = false;
      }).catch(() => { /* Local download remains available. */ });
    } catch {
      if (token === generation) {
        get("story-make").hidden = false;
        status.textContent = "Could not create the PNG. Select Make my story to try again.";
      }
    }
  }
  function save() {
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = "gdg-pink-october.png";
    document.body.append(link);
    link.click();
    link.remove();
    onExport();
    status.textContent = "Download requested on this device.";
  }
  get("story-make").onclick = () => {
    storyOpen = true;
    get("story-make").hidden = true;
    get("story-step").hidden = false;
    get("result-achievement").hidden = true;
    restartTimeout();
    generate();
  };
  download.onclick = save;
  share.onclick = async () => {
    if (!file) return;
    const token = generation;
    share.disabled = true;
    const outcome = await shareStory(file, navigator, () => { if (token === generation) save(); });
    if (token !== generation) return;
    if (outcome === "shared") onExport();
    share.disabled = false;
    status.textContent = outcome === "shared" ? "Shared with the selected app." :
      outcome === "cancelled" ? "Share cancelled. You can try again or download." : "Download requested on this device.";
  };
  get("result-photo").onclick = () => { panel.hidden = true; stopTimeout(); invalidate(); onPhoto(); };
  get("result-home").onclick = onHome;
  return {
    show(next, photo = false) {
      if (!photo) { storyOpen = false; }
      restartTimeout();
      result = next;
      invalidate();
      panel.hidden = false;
      get("story-make").hidden = storyOpen;
      get("result-achievement").hidden = storyOpen;
      get("story-step").hidden = !storyOpen;
      get("result-fact").textContent = next.fact ?? FACT;
      get("result-summary").textContent = next.percent != null ? `${next.percent}%` :
        next.total != null ? `${next.correct} / ${next.total}` : next.label;
      get("result-stars").textContent = next.stars != null ? "★".repeat(next.stars) + "☆".repeat(5 - next.stars) : "";
      const artwork = get("result-artwork");
      artwork.hidden = !next.artwork;
      if (next.artwork) {
        artwork.width = next.artwork.width;
        artwork.height = next.artwork.height;
        artwork.getContext("2d").drawImage(next.artwork, 0, 0);
      }
      get("result-photo").textContent = photo ? "Retake optional photo" : "Add optional photo";
      status.textContent = "";
      if (!storyOpen) get("result-title").focus();
      if (storyOpen) generate();
    },
    clear() { stopTimeout(); invalidate(); result = null; storyOpen = false; panel.hidden = true; },
  };
}
