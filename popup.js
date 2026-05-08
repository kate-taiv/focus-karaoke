const appEl      = document.getElementById('app');
const statsView  = document.getElementById('stats-view');
const statsBtn   = document.getElementById('stats-btn');
const backBtn    = document.getElementById('stats-back-btn');
const btn        = document.getElementById('main-btn');
const timerEl    = document.getElementById('timer');
const modeEl     = document.getElementById('mode-label');
const sessionEl  = document.getElementById('session-label');
const successMsg = document.getElementById('success-msg');
const settings         = document.getElementById('settings');
const workInput        = document.getElementById('work-input');
const workSecondsInput = document.getElementById('work-seconds-input');
const sessionsInput    = document.getElementById('sessions-input');
const leaveBtn         = document.getElementById('leave-btn');

chrome.storage.local.get(['workMinutes', 'workSeconds', 'totalSessions'], ({ workMinutes, workSeconds, totalSessions }) => {
  if (workMinutes != null)   workInput.value        = workMinutes;
  if (workSeconds != null)   workSecondsInput.value = workSeconds;
  if (totalSessions != null) sessionsInput.value    = totalSessions;
});

workInput.addEventListener('change', () => {
  const val = clampMinutes(workInput.value);
  workInput.value = val;
  chrome.storage.local.set({ workMinutes: val });
});

workSecondsInput.addEventListener('change', () => {
  const val = clampSeconds(workSecondsInput.value);
  workSecondsInput.value = val;
  chrome.storage.local.set({ workSeconds: val });
});

sessionsInput.addEventListener('change', () => {
  const val = clampSessions(sessionsInput.value);
  sessionsInput.value = val;
  chrome.storage.local.set({ totalSessions: val });
});

async function render() {
  const state = await send('GET_STATE');

  if (state.mode === 'idle') {
    modeEl.textContent = 'Ready';
    modeEl.className = '';
    const mins = clampMinutes(workInput.value);
    const secs = clampSeconds(workSecondsInput.value);
    timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    sessionEl.textContent = '';
    successMsg.textContent = '';
    settings.classList.remove('hidden');
    btn.textContent = 'Start Focus';
    btn.className = '';
    btn.disabled = false;
    leaveBtn.classList.remove('visible');
    statsBtn.style.visibility = 'visible';
  } else if (state.mode === 'success') {
    modeEl.textContent = 'Break complete!';
    modeEl.className = 'success';
    timerEl.textContent = '🌟';
    sessionEl.textContent = sessionLabel(state);
    successMsg.textContent = 'Great singing! Ready for another round?';
    settings.classList.add('hidden');
    btn.textContent = 'Start Next Session';
    btn.className = '';
    btn.disabled = false;
    leaveBtn.classList.add('visible');
    statsBtn.style.visibility = 'hidden';
  } else if (state.mode === 'complete') {
    modeEl.textContent = 'All done!';
    modeEl.className = 'complete';
    timerEl.textContent = '🏆';
    sessionEl.textContent = `${state.totalSessions} sessions complete`;
    successMsg.textContent = 'Amazing focus! Take a real break.';
    settings.classList.add('hidden');
    btn.textContent = 'Start New Block';
    btn.className = '';
    btn.disabled = false;
    leaveBtn.classList.remove('visible');
    statsBtn.style.visibility = 'visible';
  } else if (state.mode === 'work') {
    const remaining = Math.max(0, state.duration - (Date.now() - state.startTime));
    modeEl.textContent = 'Focusing';
    modeEl.className = 'work';
    timerEl.textContent = fmt(remaining);
    sessionEl.textContent = sessionLabel(state);
    settings.classList.add('hidden');
    successMsg.textContent = '';
    btn.textContent = 'Pause';
    btn.className = '';
    btn.disabled = false;
    leaveBtn.classList.add('visible');
    statsBtn.style.visibility = 'hidden';
  } else if (state.mode === 'paused') {
    modeEl.textContent = 'Paused';
    modeEl.className = 'paused';
    timerEl.textContent = fmt(state.remaining);
    sessionEl.textContent = sessionLabel(state);
    settings.classList.add('hidden');
    successMsg.textContent = '';
    btn.textContent = 'Resume';
    btn.className = '';
    btn.disabled = false;
    leaveBtn.classList.add('visible');
    statsBtn.style.visibility = 'hidden';
  } else if (state.mode === 'break') {
    modeEl.textContent = 'Karaoke Break!';
    modeEl.className = 'break';
    timerEl.textContent = '🎤';
    sessionEl.textContent = sessionLabel(state);
    settings.classList.add('hidden');
    successMsg.textContent = '';
    btn.textContent = 'Stop';
    btn.className = 'stop';
    btn.disabled = false;
    leaveBtn.classList.add('visible');
    statsBtn.style.visibility = 'hidden';
  }
}

btn.addEventListener('click', async () => {
  const state = await send('GET_STATE');
  if (state.mode === 'idle') {
    const workMinutes   = clampMinutes(workInput.value);
    const workSeconds   = clampSeconds(workSecondsInput.value);
    const totalSessions = clampSessions(sessionsInput.value);
    chrome.storage.local.set({ workMinutes, workSeconds, totalSessions });
    await send('START', { workMinutes, workSeconds, totalSessions });
    render();
  } else if (state.mode === 'success') {
    await send('CONTINUE');
    render();
  } else if (state.mode === 'work') {
    await send('PAUSE');
    render();
  } else if (state.mode === 'paused') {
    await send('RESUME');
    render();
  } else if (state.mode === 'complete') {
    await send('STOP');
    render();
  } else {
    await send('STOP');
    render();
  }
});

leaveBtn.addEventListener('click', async () => {
  await send('STOP');
  render();
});

function clampMinutes(val)  { return Math.min(120, Math.max(0,  parseInt(val, 10) || 0));  }
function clampSeconds(val)  { return Math.min(59,  Math.max(0,  parseInt(val, 10) || 0));  }
function clampSessions(val) { return Math.min(20,  Math.max(1,  parseInt(val, 10) || 4));  }

function sessionLabel(state) {
  return state.totalSessions
    ? `Session ${state.session} / ${state.totalSessions}`
    : `Session ${state.session}`;
}

function fmt(ms) {
  const total = Math.ceil(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function send(type, extra = {}) {
  return chrome.runtime.sendMessage({ type, ...extra });
}

statsBtn.addEventListener('click', () => {
  appEl.classList.add('hidden');
  statsView.classList.remove('hidden');
  renderStats();
});

backBtn.addEventListener('click', () => {
  statsView.classList.add('hidden');
  appEl.classList.remove('hidden');
});

async function renderStats() {
  const s = await new Promise(r => chrome.storage.local.get('stats', d => r(d.stats || { sessions: 0, blocks: 0, focusMs: 0 })));
  document.getElementById('stat-blocks').textContent   = s.blocks;
  document.getElementById('stat-sessions').textContent = s.sessions;
  document.getElementById('stat-time').textContent     = fmtDuration(s.focusMs);
}

function fmtDuration(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

render();
setInterval(render, 1000);
