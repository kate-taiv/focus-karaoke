const SING_THRESHOLD = 0.05;
const GOAL_SECONDS = 30;

(async () => {
  const { karaokeBreak } = await chrome.storage.local.get('karaokeBreak');
  if (!karaokeBreak?.active) return;

  // Only activate on the specific karaoke video tab
  const params = new URLSearchParams(location.search);
  if (params.get('v') !== karaokeBreak.videoId) return;

  // Wait for the YouTube player to render before injecting the panel
  await new Promise(r => setTimeout(r, 2500));
  injectPanel(karaokeBreak.title);
})();

function injectPanel(title) {
  const panel = document.createElement('div');
  panel.id = 'fk-panel';
  panel.innerHTML = `
    <div id="fk-left">
      <div id="fk-label">🎤 KARAOKE BREAK</div>
      <div id="fk-title">${title}</div>
      <div id="fk-status">Enable mic and start singing to end your break</div>
    </div>
    <div id="fk-center">
      <div id="fk-progress-wrap">
        <div id="fk-progress-bar"></div>
      </div>
      <div id="fk-progress-label">0 / ${GOAL_SECONDS}s</div>
    </div>
    <div id="fk-right">
      <button id="fk-mic-btn">🎤 Enable Mic</button>
    </div>
  `;
  document.body.appendChild(panel);
  document.getElementById('fk-mic-btn').addEventListener('click', startMic);
}

let singSeconds = 0;
let lastTs = null;
let rafId;

async function startMic() {
  const btn = document.getElementById('fk-mic-btn');
  const status = document.getElementById('fk-status');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);

    btn.disabled = true;
    btn.textContent = '🎤 Listening...';
    rafId = requestAnimationFrame(ts => tick(ts, analyser, ctx, status));
  } catch {
    status.textContent = 'Mic access denied — click the mic icon in the address bar to allow it.';
  }
}

function tick(ts, analyser, ctx, status) {
  const dt = lastTs === null ? 0 : (ts - lastTs) / 1000;
  lastTs = ts;

  const buf = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (const v of buf) { const n = v / 128 - 1; sum += n * n; }
  const rms = Math.sqrt(sum / buf.length);

  if (rms > SING_THRESHOLD) {
    singSeconds = Math.min(GOAL_SECONDS, singSeconds + dt);
    status.textContent = '🎤 Singing detected! Keep going!';
    status.style.color = '#f9a8d4';
  } else {
    status.textContent = 'Mic active — sing louder!';
    status.style.color = '#6ee7b7';
  }

  const pct = (singSeconds / GOAL_SECONDS) * 100;
  document.getElementById('fk-progress-bar').style.width = `${pct}%`;
  document.getElementById('fk-progress-label').textContent =
    `${Math.floor(singSeconds)} / ${GOAL_SECONDS}s`;

  if (singSeconds >= GOAL_SECONDS) {
    ctx.close();
    status.textContent = '✅ Break complete! Great singing!';
    status.style.color = '#6ee7b7';
    setTimeout(() => chrome.runtime.sendMessage({ type: 'BREAK_COMPLETE' }), 800);
    return;
  }

  rafId = requestAnimationFrame(ts => tick(ts, analyser, ctx, status));
}
