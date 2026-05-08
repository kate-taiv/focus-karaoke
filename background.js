const DEFAULT_WORK_MS = 25 * 60 * 1000;

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

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'workEnd') return;
  const state = await getState();

  await addStats({ sessions: 1, focusMs: state.duration });

  if (state.totalSessions && state.session >= state.totalSessions) {
    await addStats({ blocks: 1 });
    await setState({ ...state, mode: 'complete' });
    return;
  }

  const video = VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
  await setState({ ...state, mode: 'break' });
  await new Promise(r => chrome.storage.local.set({ karaokeBreak: { active: true, videoId: video.id, title: video.title } }, r));
  chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${video.id}` });
});

async function addStats({ sessions = 0, blocks = 0, focusMs = 0 }) {
  const s = await new Promise(r => chrome.storage.local.get('stats', d => r(d.stats || { sessions: 0, blocks: 0, focusMs: 0 })));
  await new Promise(r => chrome.storage.local.set({ stats: { sessions: s.sessions + sessions, blocks: s.blocks + blocks, focusMs: s.focusMs + focusMs } }, r));
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg, sender).then(sendResponse);
  return true;
});

async function handle(msg, sender) {
  if (msg.type === 'START') {
    const workMs = Math.max(1000, ((msg.workMinutes ?? 25) * 60 + (msg.workSeconds ?? 0)) * 1000);
    await setState({ mode: 'work', startTime: Date.now(), duration: workMs, session: 1, totalSessions: msg.totalSessions || 0 });
    chrome.alarms.create('workEnd', { when: Date.now() + workMs });
    return { ok: true };
  }

  if (msg.type === 'STOP') {
    await setState({ mode: 'idle' });
    await new Promise(r => chrome.storage.local.remove('karaokeBreak', r));
    chrome.alarms.clear('workEnd');
    return { ok: true };
  }

  if (msg.type === 'BREAK_COMPLETE') {
    const state = await getState();
    const session = (state.session || 1) + 1;
    await setState({ ...state, mode: 'success', session });
    await new Promise(r => chrome.storage.local.remove('karaokeBreak', r));
    if (sender.tab) chrome.tabs.remove(sender.tab.id);
    return { ok: true };
  }

  if (msg.type === 'PAUSE') {
    const state = await getState();
    const remaining = Math.max(0, state.duration - (Date.now() - state.startTime));
    await setState({ ...state, mode: 'paused', remaining });
    chrome.alarms.clear('workEnd');
    return { ok: true };
  }

  if (msg.type === 'RESUME') {
    const state = await getState();
    await setState({ ...state, mode: 'work', startTime: Date.now(), duration: state.remaining });
    chrome.alarms.create('workEnd', { when: Date.now() + state.remaining });
    return { ok: true };
  }

  if (msg.type === 'CONTINUE') {
    const state = await getState();
    await setState({ ...state, mode: 'work', startTime: Date.now() });
    chrome.alarms.create('workEnd', { when: Date.now() + state.duration });
    return { ok: true };
  }

  if (msg.type === 'GET_STATE') {
    return getState();
  }
}

function getState() {
  return new Promise(r =>
    chrome.storage.local.get('state', d => r(d.state || { mode: 'idle' }))
  );
}

function setState(s) {
  return new Promise(r => chrome.storage.local.set({ state: s }, r));
}
