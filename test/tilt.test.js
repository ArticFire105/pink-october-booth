import test from "node:test";
import assert from "node:assert/strict";
import { createTiltMachine, eyeLineRadians, eyeLineFromLandmarks, normalizeEyeAngle } from "../js/tilt.js";
const rad = n => n * Math.PI / 180;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function calibrated(neutral = 0) {
  const machine = createTiltMachine({ emaAlpha: 1 });
  machine.update(neutral, 0);
  machine.update(neutral, 400);
  assert.equal(machine.update(neutral, 800).calibrating, false);
  return machine;
}

test("eye line uses pixel aspect ratio and ignores endpoint ordering", () => {
  const a = { x: 0.3, y: 0.4 }, b = { x: 0.7, y: 0.6 };
  const expected = Math.atan2(0.2 * 720, 0.4 * 1280);
  close(eyeLineRadians(a, b, 1280, 720), expected);
  close(eyeLineRadians(b, a, 1280, 720), expected);
  const landmarks = Array(264);
  landmarks[33] = a; landmarks[263] = b;
  close(eyeLineFromLandmarks(landmarks, 1280, 720), expected);
  assert.equal(eyeLineRadians(a, a, 1280, 720), null);
  assert.equal(eyeLineFromLandmarks([], 1280, 720), null);
  assert.equal(eyeLineRadians(a, b, 0, 720), null);
});

test("angles wrap around 180 degrees to the same eye line", () => {
  close(normalizeEyeAngle(rad(179)), rad(-1));
  close(normalizeEyeAngle(rad(-179)), rad(1));
  for (let degrees = -720; degrees <= 720; degrees++) {
    const n = normalizeEyeAngle(rad(degrees));
    assert.ok(n >= -Math.PI / 2 && n <= Math.PI / 2);
  }
});

test("mirrored left is MYTH, right is FACT, straight never answers", () => {
  for (const [degrees, expected] of [[20, "myth"], [-20, "fact"], [0, null]]) {
    const machine = calibrated(rad(5));
    assert.equal(machine.update(rad(degrees + 5), 900).confirmed, null);
    assert.equal(machine.update(rad(degrees + 5), 1600).confirmed, expected);
  }
});

test("swap reverses tilt after subtracting calibrated neutral", () => {
  const machine = calibrated(rad(10));
  machine.update(rad(30), 900, true);
  assert.equal(machine.update(rad(30), 1600, true).confirmed, "fact");
});

test("calibration and subtraction survive the normalized angle boundary", () => {
  const machine = createTiltMachine({ emaAlpha: 1 });
  machine.update(rad(89), 0);
  machine.update(rad(-89), 400);
  assert.equal(machine.update(rad(89), 800).calibrating, false);
  const sample = machine.update(rad(-89), 900);
  assert.ok(Math.abs(sample.angle) < rad(3));
  assert.equal(sample.pending, null);
});

test("missing face resets calibration time and pending hold", () => {
  const machine = createTiltMachine({ emaAlpha: 1 });
  machine.update(0, 0); machine.update(0, 400);
  assert.equal(machine.update(null, 700).calibrationProgress, 0);
  assert.equal(machine.update(0, 1000).calibrating, true);
  machine.update(0, 1400); machine.update(0, 1800);
  machine.update(rad(20), 1900);
  assert.equal(machine.update(null, 2599).confirmed, null);
  assert.equal(machine.update(rad(20), 2600).progress, 0);
  assert.equal(machine.update(rad(20), 3300).confirmed, "myth");
});

test("long face loss recalibrates; missing face cannot satisfy recenter", () => {
  const machine = calibrated();
  machine.disarm();
  machine.update(null, 900);
  assert.equal(machine.update(rad(20), 950).phase, "recenter");
  machine.update(null, 1000);
  assert.equal(machine.update(null, 1900).calibrating, true);
});

test("held pose cannot answer the next question until centered", () => {
  const machine = calibrated();
  machine.update(rad(20), 900); machine.update(rad(20), 1600);
  machine.disarm();
  assert.equal(machine.update(rad(20), 3000).confirmed, null);
  machine.update(0, 3100);
  machine.update(rad(-20), 3200);
  assert.equal(machine.update(rad(-20), 3900).confirmed, "fact");
});

test("tap or swap before calibration cannot bypass neutral calibration", () => {
  const machine = createTiltMachine({ emaAlpha: 1 });
  machine.disarm();
  assert.equal(machine.update(rad(20), 0).calibrating, true);
  machine.update(rad(20), 400);
  assert.equal(machine.update(rad(20), 800).calibrating, false);
  assert.equal(machine.update(rad(20), 900).pending, null);
});
