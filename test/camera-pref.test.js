import test from "node:test";
import assert from "node:assert/strict";
import { preferCamera } from "../js/camera-pref.js";

const cam = (deviceId, label) => ({ kind: "videoinput", deviceId, label });

test("prefers integrated/built-in cameras over phone and virtual ones", () => {
  assert.equal(preferCamera([cam("a", "iPhone Camera"), cam("b", "Integrated Camera (04f2:b6dd)")]).deviceId, "b");
  assert.equal(preferCamera([cam("a", "OBS Virtual Camera"), cam("b", "FaceTime HD Camera")]).deviceId, "b");
  assert.equal(preferCamera([cam("a", "Camo"), cam("b", "HD Webcam")]).deviceId, "b");
  assert.equal(preferCamera([cam("a", "Continuity Camera"), cam("b", "Built-in Camera")]).deviceId, "b");
  assert.equal(preferCamera([cam("a", "Phone Link camera"), cam("b", "USB2.0 HD UVC WebCam"), cam("c", "Front Camera")]).deviceId, "c");
});

test("falls back to any non-phone camera, then to the only one", () => {
  assert.equal(preferCamera([cam("a", "iPhone Camera"), cam("b", "Logitech C920")]).deviceId, "b");
  assert.equal(preferCamera([cam("a", "Rishi's iPhone Camera")]).deviceId, "a");
  assert.equal(preferCamera([{ kind: "audioinput", deviceId: "m", label: "Mic" }]), null);
  assert.equal(preferCamera([]), null);
});

test("unlabelled devices (before permission) still yield the first", () => {
  assert.equal(preferCamera([cam("a", ""), cam("b", "")]).deviceId, "a");
});
