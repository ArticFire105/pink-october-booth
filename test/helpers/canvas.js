export function mockContext(overrides = {}) {
  return {
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    beginPath() {}, roundRect() {}, fill() {}, stroke() {}, moveTo() {},
    bezierCurveTo() {}, quadraticCurveTo() {}, arc() {}, strokeRect() {},
    fillRect() {}, fillText() {}, drawImage() {},
    createRadialGradient() { return { addColorStop() {} }; },
    measureText(text) { return { width: text.length * (parseFloat(this.font?.match(/[\d.]+px/)?.[0]) || 40) * .5 }; },
    ...overrides,
  };
}
