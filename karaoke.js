// All from Sing King Karaoke — a channel that allows embedding
const VIDEOS = [
  { title: 'Bohemian Rhapsody — Queen',             id: '9Lxm0iSnKNc' },
  { title: 'Someone Like You — Adele',              id: 'BPRoNqB2XK8' },
  { title: 'Shape Of You — Ed Sheeran',             id: 'o71_MatpYV0' },
  { title: 'Rolling In The Deep — Adele',           id: 'LOd3u6FtkAk' },
  { title: "Don't Stop Believin' — Journey",        id: 'c8wn2fMYvns' },
  { title: 'Sweet Caroline — Neil Diamond',         id: 'srLoAl1mhFw' },
  { title: 'Take On Me — a-ha',                     id: 'bC4ER15Hj10' },
  { title: 'Mr. Brightside — The Killers',          id: 'c1X3Lg7RVkk' },
  { title: 'Sweet Home Alabama — Lynyrd Skynyrd',   id: 'ShMxICBtGNg' },
  { title: 'Piano Man — Billy Joel',                id: 'rW2541x8VzY' },
];

const SING_THRESHOLD = 0.15;  // RMS volume to count as singing (0–1)
const GOAL_SECONDS  = 30;     // seconds of singing needed to end break

const ytEl     = document.getElementById('yt');
const micBtn   = document.getElementById('mic-btn');
const micStatus= document.getElementById('mic-status');
const progressBar   = document.getElementById('progress-bar');
const progressLabel = document.getElementById('progress-label');

async function canEmbed(id) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function pickVideo() {
  const shuffled = [...VIDEOS].sort(() => Math.random() - 0.5);
  for (const v of shuffled) {
    if (await canEmbed(v.id)) return v;
  }
  return shuffled[0]; // fallback: try anyway
}

pickVideo().then(video => {
  ytEl.src = `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`;
  document.getElementById('subtitle').textContent =
    `🎵 ${video.title} — Sing along to end your break!`;
});

let singSeconds = 0;
let audioCtx, analyser, source, rafId;

micBtn.addEventListener('click', startMic);

async function startMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx  = new AudioContext();
    analyser  = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source    = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    micBtn.disabled = true;
    micStatus.textContent = 'Mic active — start singing!';
    micStatus.className = 'active';

    requestAnimationFrame(tick);
  } catch (err) {
    micStatus.textContent = 'Mic access denied — grant permission and try again.';
  }
}

let lastTs = null;

function tick(ts) {
  const dt = lastTs === null ? 0 : (ts - lastTs) / 1000;
  lastTs = ts;
  const buf = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(buf);

  // RMS volume
  let sum = 0;
  for (const v of buf) { const n = v / 128 - 1; sum += n * n; }
  const rms = Math.sqrt(sum / buf.length);

  const singing = rms > SING_THRESHOLD;

  if (singing) {
    singSeconds = Math.min(GOAL_SECONDS, singSeconds + dt);
    micStatus.textContent = '🎤 Singing detected!';
    micStatus.className = 'singing';
  } else {
    micStatus.textContent = 'Mic active — sing louder!';
    micStatus.className = 'active';
  }

  const pct = (singSeconds / GOAL_SECONDS) * 100;
  progressBar.style.width = `${pct}%`;
  progressLabel.textContent =
    `${Math.floor(singSeconds)} / ${GOAL_SECONDS} seconds of singing`;

  if (singSeconds >= GOAL_SECONDS) {
    finish();
    return;
  }

  rafId = requestAnimationFrame(tick);
}

function finish() {
  cancelAnimationFrame(rafId);
  audioCtx?.close();

  // Show done state
  micStatus.textContent = '✅ Break complete! Great singing!';
  micStatus.className = 'active';

  // Notify background to start next work session
  chrome.runtime.sendMessage({ type: 'BREAK_COMPLETE' });
}
