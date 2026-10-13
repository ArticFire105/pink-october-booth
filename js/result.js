import { FACT, SOURCE, ensureStoryFonts, renderStory, pngBlob, shareStory } from "./story.js";

export function createResultScreen({ onHome, onExport = () => {},
  schedule = setTimeout, cancel = clearTimeout }) {
  const get = id => document.getElementById(id);
  const panel = get("result");
  const preview = get("story-preview");
  const status = get("story-status");
  const share = get("story-share");
  const download = get("story-download");
  const photoDownload = get("photo-download");
  let result = null, file = null, url = "", heartURL = "", generation = 0;
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
    if (heartURL && heartURL !== url) URL.revokeObjectURL(heartURL);
    heartURL = "";
    photoDownload.disabled = true;
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
      await ensureStoryFonts();
      if (token !== generation) return;
      const canvas = renderStory(document.createElement("canvas"), {
        ...result, artwork: result.heartArtwork ?? result.artwork, variant: "heart",
      });
      const heartBlob = await pngBlob(canvas);
      if (token !== generation) return;
      const blob = result.photoArtwork ? await pngBlob(renderStory(document.createElement("canvas"), {
        ...result, artwork: result.photoArtwork, variant: "photo",
      })) : heartBlob;
      if (token !== generation) return;
      file = new File([blob], "gdg-pink-october.png", { type: "image/png" });
      heartURL = URL.createObjectURL(heartBlob);
      url = result.photoArtwork ? URL.createObjectURL(blob) : heartURL;
      photoDownload.disabled = false;
      preview.src = url;
      preview.hidden = false;
      share.disabled = download.disabled = false;
      status.textContent = "Your story is ready.";
    } catch {
      if (token === generation) {
        status.textContent = "Could not create the PNG. Please return and try again.";
      }
    }
  }
  function save(target = url, name = "gdg-pink-october.png") {
    if (!target) return;
    const link = document.createElement("a");
    link.href = target;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    onExport();
    status.textContent = "Download requested on this device.";
  }
  download.onclick = () => save(heartURL, "pink-october-heart.png");
  photoDownload.onclick = () => save(url, "pink-october-photo.png");
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
  get("result-home").onclick = onHome;
  return {
    show(next, photo = false) {
      restartTimeout();
      result = next;
      invalidate();
      panel.hidden = false;
      get("result-achievement").hidden = true;
      get("story-step").hidden = false;
      photoDownload.hidden = !next.photoArtwork;
      download.textContent = next.heartArtwork || next.artwork ? "Download heart image" : "Download story";
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
      status.textContent = "";
      generate();
    },
    clear() { stopTimeout(); invalidate(); result = null; panel.hidden = true; },
  };
}
