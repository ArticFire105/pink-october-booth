// Shared read-only screen gate; never changes the camera or game state.
export function cameraScreenState({ stageVisible = false, cameraActive = false } = {}) {
  return Boolean(stageVisible || cameraActive);
}

export function isCameraScreen(doc = globalThis.document) {
  const stage = doc?.getElementById?.('stage');
  const videos = Array.from(doc?.querySelectorAll?.('video') || []);
  return cameraScreenState({
    stageVisible: Boolean(stage && !stage.hidden),
    cameraActive: videos.some(video => video.srcObject?.getVideoTracks?.()
      .some(track => track.readyState === 'live')),
  });
}

export function onScreenChange(callback, doc = globalThis.document) {
  const update = () => callback(isCameraScreen(doc));
  const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(update);
  for (const id of ['stage', 'home']) {
    const element = doc?.getElementById?.(id);
    if (element) observer?.observe(element, { attributes: true, attributeFilter: ['hidden'] });
  }
  // Media events also cover a live stream on an otherwise hidden stage.
  const events = ['loadedmetadata', 'playing', 'emptied', 'ended'];
  events.forEach(event => doc?.addEventListener?.(event, update, true));
  update();
  return () => {
    observer?.disconnect();
    events.forEach(event => doc?.removeEventListener?.(event, update, true));
  };
}
