// End-to-end verification of the OriginalAudioPage (wavesurfer import → waveform → region → play)
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

function generateWav(seconds = 3, sampleRate = 44100) {
  const numSamples = Math.floor(seconds * sampleRate);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = (i > numSamples * 0.3 && i < numSamples * 0.7) ? 1 : 0.2;
    const sample = Math.sin(2 * Math.PI * 440 * t) * env * 0.8;
    buffer.writeInt16LE(sample * 32767, 44 + i * 2);
  }
  return buffer;
}

const executablePath = process.env.CHROME_PATH;
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
const consoleLogs = [];
page.on('console', (msg) => {
  const t = msg.text();
  consoleLogs.push(`[${msg.type()}] ${t.slice(0, 200)}`);
  if (msg.type() === 'error') errors.push('console: ' + t);
});
page.on('pageerror', (err) => errors.push('pageerror: ' + String(err)));

await page.goto('http://localhost:4173/TuneTutor/#/audio', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

// 1. Import a synthetic WAV via the hidden file input
await page.setInputFiles('input[type=file]', {
  name: 'test.wav',
  mimeType: 'audio/wav',
  buffer: generateWav(3),
});

// poll body state for 8s, capturing transitions
const state = { fileName: false, duration: false, waveform: false, region: 0, sliceText: false, stop: false };
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(200);
  const s = await page.evaluate(() => {
    const text = document.body.textContent;
    const c = document.querySelector('.canvases') ?? document.querySelector('.wrapper');
    return {
      fileName: text.includes('test.wav'),
      duration: text.includes('Duration'),
      waveform: !!c && c.querySelectorAll('canvas').length > 0,
      region: document.querySelectorAll('[part^="region"]').length,
      sliceText: text.includes('Slice:'),
      stop: text.includes('Stop'),
    };
  });
  Object.assign(state, s);
  if (state.fileName && state.duration) break;
}
state.buttons = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter(Boolean).slice(0, 8));

// 2. Drag on the waveform to create a slice region
const wsBox = await page.locator('.canvases').first().boundingBox();
if (wsBox) {
  await page.mouse.move(wsBox.x + wsBox.width * 0.2, wsBox.y + wsBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(wsBox.x + wsBox.width * 0.6, wsBox.y + wsBox.height / 2, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  state.region = await page.evaluate(() => document.querySelectorAll('[part^="region"]').length);
  state.sliceText = await page.evaluate(() => document.body.textContent.includes('Slice:'));
}

// 3. Click the loop-slice play button
const playClicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Loop slice'));
  if (btn) { btn.click(); return true; }
  return false;
});
await page.waitForTimeout(1500);
state.stop = await page.evaluate(() => document.body.textContent.includes('Stop'));

// 4. Reload — verify persistence restores the audio file
await page.reload({ waitUntil: 'networkidle' });
let restored = false;
try {
  await page.waitForSelector('text=test.wav', { timeout: 8000 });
  restored = true;
} catch { /* not restored */ }

const result = { state, playClicked, restored, errors: errors.slice(0, 12), consoleLogs: consoleLogs.slice(-15) };
console.log(JSON.stringify(result, null, 2));
writeFileSync('/tmp/verify-audio-result.json', JSON.stringify(result, null, 2));
await browser.close();
