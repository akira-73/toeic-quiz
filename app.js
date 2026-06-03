const STORAGE_KEY = 'toeic_quiz_progress';

let state = {
  mode: 'all',        // 'all' | 'mistakes'
  queue: [],
  current: null,
  choices: [],
  answered: false,
  selectedIndex: null,
  stats: { correct: 0, total: 0 },
  progress: {},       // { word: { correct: bool, seen: bool } }
  sessionComplete: false,
};

function loadProgress() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) state.progress = JSON.parse(saved);
  } catch (e) {
    state.progress = {};
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQueue() {
  if (state.mode === 'mistakes') {
    const mistakes = WORDS.filter(w => {
      const p = state.progress[w.word];
      return p && p.seen && !p.correct;
    });
    if (mistakes.length === 0) return false;
    state.queue = shuffle(mistakes);
  } else {
    state.queue = shuffle(WORDS);
  }
  state.stats = { correct: 0, total: 0 };
  state.sessionComplete = false;
  return true;
}

function nextQuestion() {
  if (state.queue.length === 0) {
    state.sessionComplete = true;
    render();
    return;
  }
  state.current = state.queue.pop();
  state.answered = false;
  state.selectedIndex = null;

  const wrongPool = WORDS.filter(w => w.word !== state.current.word);
  const wrongs = shuffle(wrongPool).slice(0, 3).map(w => w.meaning);
  const all = shuffle([state.current.meaning, ...wrongs]);
  state.choices = all;

  render();
}

function answer(index) {
  if (state.answered) return;
  state.answered = true;
  state.selectedIndex = index;
  state.stats.total++;

  const isCorrect = state.choices[index] === state.current.meaning;
  if (isCorrect) {
    state.stats.correct++;
    state.progress[state.current.word] = { seen: true, correct: true };
  } else {
    state.progress[state.current.word] = { seen: true, correct: false };
  }
  saveProgress();
  render();
}

function resetProgress() {
  if (!confirm('全ての学習履歴をリセットしますか？')) return;
  state.progress = {};
  saveProgress();
  startMode(state.mode);
}

function startMode(mode) {
  state.mode = mode;
  const ok = buildQueue();
  if (!ok) {
    alert('間違えた単語がありません。まずは通常モードで挑戦してみましょう！');
    return;
  }
  nextQuestion();
}

function countMistakes() {
  return WORDS.filter(w => {
    const p = state.progress[w.word];
    return p && p.seen && !p.correct;
  }).length;
}

function countLearned() {
  return WORDS.filter(w => {
    const p = state.progress[w.word];
    return p && p.correct;
  }).length;
}

function render() {
  const app = document.getElementById('app');

  if (state.sessionComplete) {
    const pct = state.stats.total > 0
      ? Math.round((state.stats.correct / state.stats.total) * 100)
      : 0;
    app.innerHTML = `
      <div class="card result-card">
        <div class="result-emoji">${pct >= 80 ? '🎉' : pct >= 60 ? '👍' : '💪'}</div>
        <h2>セッション完了！</h2>
        <div class="result-score">${state.stats.correct} / ${state.stats.total} 正解</div>
        <div class="result-pct">${pct}%</div>
        <div class="result-stats">
          <div class="stat-item">
            <span class="stat-label">習得済み</span>
            <span class="stat-value learned">${countLearned()}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">要復習</span>
            <span class="stat-value mistake">${countMistakes()}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">総単語数</span>
            <span class="stat-value">${WORDS.length}</span>
          </div>
        </div>
        <div class="btn-group">
          <button class="btn btn-primary" onclick="startMode('all')">全単語モード</button>
          ${countMistakes() > 0
            ? `<button class="btn btn-warning" onclick="startMode('mistakes')">復習モード (${countMistakes()}語)</button>`
            : ''}
        </div>
      </div>
    `;
    return;
  }

  if (!state.current) {
    renderHome();
    return;
  }

  const remaining = state.queue.length;
  const total = state.mode === 'mistakes'
    ? WORDS.filter(w => state.progress[w.word] && !state.progress[w.word].correct).length
    : WORDS.length;
  const done = state.stats.total;
  const progress = total > 0 ? Math.round(((done) / (done + remaining)) * 100) : 0;

  const correctIdx = state.choices.indexOf(state.current.meaning);

  app.innerHTML = `
    <div class="header">
      <div class="mode-badge ${state.mode === 'mistakes' ? 'mode-mistakes' : 'mode-all'}">
        ${state.mode === 'mistakes' ? '復習モード' : '全単語モード'}
      </div>
      <div class="score">${state.stats.correct} / ${state.stats.total}</div>
    </div>

    <div class="progress-bar-wrap">
      <div class="progress-bar" style="width: ${progress}%"></div>
    </div>
    <div class="progress-label">残り ${remaining + 1} 問</div>

    <div class="card word-card">
      <div class="word-label">英単語</div>
      <div class="word">${state.current.word}</div>
    </div>

    <div class="choices">
      ${state.choices.map((c, i) => {
        let cls = 'choice';
        if (state.answered) {
          if (i === correctIdx) cls += ' correct';
          else if (i === state.selectedIndex) cls += ' wrong';
          else cls += ' dimmed';
        }
        return `<button class="${cls}" onclick="answer(${i})" ${state.answered ? 'disabled' : ''}>${c}</button>`;
      }).join('')}
    </div>

    ${state.answered ? `
      <div class="feedback-card ${state.choices[state.selectedIndex] === state.current.meaning ? 'feedback-correct' : 'feedback-wrong'}">
        <div class="feedback-label">
          ${state.choices[state.selectedIndex] === state.current.meaning ? '✓ 正解！' : '✗ 不正解'}
        </div>
        <div class="feedback-answer">正解: <strong>${state.current.meaning}</strong></div>
        <div class="feedback-example">
          <span class="example-label">例文</span>
          <p>${state.current.example}</p>
        </div>
        <button class="btn btn-primary btn-next" onclick="nextQuestion()">次へ →</button>
      </div>
    ` : ''}
  `;
}

function renderHome() {
  const app = document.getElementById('app');
  const mistakes = countMistakes();
  const learned = countLearned();

  app.innerHTML = `
    <div class="home">
      <div class="home-title">
        <div class="home-icon">📚</div>
        <h1>TOEIC 単語クイズ</h1>
        <p class="home-sub">${WORDS.length}語収録</p>
      </div>

      <div class="home-stats">
        <div class="stat-item">
          <span class="stat-value learned">${learned}</span>
          <span class="stat-label">習得済み</span>
        </div>
        <div class="stat-item">
          <span class="stat-value mistake">${mistakes}</span>
          <span class="stat-label">要復習</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${WORDS.length}</span>
          <span class="stat-label">総単語数</span>
        </div>
      </div>

      <div class="btn-group">
        <button class="btn btn-primary btn-lg" onclick="startMode('all')">
          🗂 全単語モードで始める
        </button>
        <button class="btn btn-warning btn-lg ${mistakes === 0 ? 'btn-disabled' : ''}"
          onclick="${mistakes > 0 ? "startMode('mistakes')" : ''}">
          🔁 復習モード（${mistakes}語）
        </button>
      </div>

      ${learned > 0 || mistakes > 0 ? `
        <button class="btn btn-reset" onclick="resetProgress()">履歴をリセット</button>
      ` : ''}
    </div>
  `;
}

loadProgress();
render();
