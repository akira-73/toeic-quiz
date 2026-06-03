const STORAGE_KEY = 'toeic_quiz_progress';
const HISTORY_KEY = 'toeic_quiz_history';

let state = {
  mode: 'all',
  filterLevel: 'all',
  filterCategory: 'all',
  questionCount: 20,       // 10 | 20 | 30 | 50 | 100 | 0(=all)
  queue: [],
  current: null,
  choices: [],
  answered: false,
  selectedIndex: null,
  stats: { correct: 0, total: 0 },
  progress: {},
  history: [],
  screen: 'home',
};

function loadStorage() {
  try {
    const p = localStorage.getItem(STORAGE_KEY);
    if (p) state.progress = JSON.parse(p);
    const h = localStorage.getItem(HISTORY_KEY);
    if (h) state.history = JSON.parse(h);
  } catch (e) {}
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getFilteredWords() {
  return WORDS.filter(w => {
    const lvlOk = state.filterLevel === 'all' || w.level === state.filterLevel;
    const catOk = state.filterCategory === 'all' || w.category === state.filterCategory;
    return lvlOk && catOk;
  });
}

function buildQueue() {
  const filtered = getFilteredWords();

  let pool;
  if (state.mode === 'mistakes') {
    pool = filtered.filter(w => {
      const p = state.progress[w.word];
      return p && p.seen && !p.correct;
    });
    if (pool.length === 0) return false;
  } else {
    pool = filtered;
    if (pool.length === 0) return false;
  }

  const shuffled = shuffle(pool);
  const limit = state.questionCount === 0 ? shuffled.length : Math.min(state.questionCount, shuffled.length);
  state.queue = shuffled.slice(0, limit);
  state.stats = { correct: 0, total: 0 };
  return true;
}

function nextQuestion() {
  if (state.queue.length === 0) {
    finishSession();
    return;
  }
  state.current = state.queue.pop();
  state.answered = false;
  state.selectedIndex = null;
  state.screen = 'quiz';

  const wrongPool = WORDS.filter(w => w.word !== state.current.word);
  const wrongs = shuffle(wrongPool).slice(0, 3).map(w => w.meaning);
  state.choices = shuffle([state.current.meaning, ...wrongs]);
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

function finishSession() {
  const pct = state.stats.total > 0
    ? Math.round((state.stats.correct / state.stats.total) * 100) : 0;
  const record = {
    date: new Date().toISOString(),
    mode: state.mode,
    level: state.filterLevel,
    category: state.filterCategory,
    questionCount: state.stats.total,
    correct: state.stats.correct,
    total: state.stats.total,
    pct,
  };
  state.history = [record, ...state.history].slice(0, 30);
  saveHistory();
  state.screen = 'result';
  render();
}

function resetProgress() {
  if (!confirm('全ての学習履歴をリセットしますか？')) return;
  state.progress = {};
  saveProgress();
  state.screen = 'home';
  render();
}

function startMode(mode) {
  state.mode = mode;
  const ok = buildQueue();
  if (!ok) {
    if (mode === 'mistakes') {
      alert('現在のフィルター条件で間違えた単語がありません。');
    } else {
      alert('条件に一致する単語がありません。フィルターを変更してください。');
    }
    return;
  }
  nextQuestion();
}

function setFilter(type, value) {
  if (type === 'level') state.filterLevel = value;
  if (type === 'category') state.filterCategory = value;
  if (type === 'count') state.questionCount = Number(value);
  render();
}

function countMistakes() {
  return getFilteredWords().filter(w => {
    const p = state.progress[w.word];
    return p && p.seen && !p.correct;
  }).length;
}

function countLearned() {
  return WORDS.filter(w => state.progress[w.word]?.correct).length;
}

// ── Render ───────────────────────────────────────────────

function render() {
  if (state.screen === 'home')    { renderHome();    return; }
  if (state.screen === 'quiz')    { renderQuiz();    return; }
  if (state.screen === 'result')  { renderResult();  return; }
  if (state.screen === 'history') { renderHistory(); return; }
}

function chips(type, options, current) {
  return options.map(o => `
    <button class="chip ${String(current) === String(o.value) ? 'chip-active' : ''}"
      onclick="setFilter('${type}', '${o.value}')">
      ${o.label}
    </button>
  `).join('');
}

function renderHome() {
  const app = document.getElementById('app');
  const mistakes = countMistakes();
  const learned  = countLearned();
  const filtered = getFilteredWords();

  const available = state.questionCount === 0
    ? filtered.length
    : Math.min(state.questionCount, filtered.length);

  const levelOpts = [
    { value: 'all',          label: '全レベル' },
    { value: 'basic',        label: '🟢 初級'  },
    { value: 'intermediate', label: '🟡 中級'  },
    { value: 'advanced',     label: '🔴 上級'  },
  ];
  const categoryOpts = [
    { value: 'all',       label: '全品詞'  },
    { value: 'verb',      label: '動詞'    },
    { value: 'noun',      label: '名詞'    },
    { value: 'adjective', label: '形容詞'  },
    { value: 'other',     label: 'その他'  },
  ];
  const countOpts = [
    { value: 10,  label: '10問'  },
    { value: 20,  label: '20問'  },
    { value: 30,  label: '30問'  },
    { value: 50,  label: '50問'  },
    { value: 100, label: '100問' },
    { value: 0,   label: '全問'  },
  ];

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

      <div class="filter-section">
        <div class="filter-label">問題数</div>
        <div class="chips">${chips('count', countOpts, state.questionCount)}</div>

        <div class="filter-label" style="margin-top:14px">難易度</div>
        <div class="chips">${chips('level', levelOpts, state.filterLevel)}</div>

        <div class="filter-label" style="margin-top:14px">品詞</div>
        <div class="chips">${chips('category', categoryOpts, state.filterCategory)}</div>

        <div class="filter-count">対象: <strong>${available}問</strong>（${filtered.length}語中）</div>
      </div>

      <div class="btn-group">
        <button class="btn btn-primary btn-lg" onclick="startMode('all')">
          ▶ スタート
        </button>
        <button class="btn btn-warning btn-lg ${mistakes === 0 ? 'btn-disabled' : ''}"
          onclick="${mistakes > 0 ? "startMode('mistakes')" : ''}">
          🔁 復習モード（${mistakes}語）
        </button>
      </div>

      <div class="home-footer">
        <button class="btn-text" onclick="state.screen='history';render()">📊 スコア履歴</button>
        ${learned > 0 || mistakes > 0
          ? `<button class="btn-text danger" onclick="resetProgress()">🗑 履歴リセット</button>`
          : ''}
      </div>
    </div>
  `;
}

function renderQuiz() {
  const app = document.getElementById('app');
  const remaining = state.queue.length;
  const done = state.stats.total;
  const totalInSession = done + remaining + (state.answered ? 0 : 1);
  const progress = totalInSession > 0 ? Math.round((done / totalInSession) * 100) : 0;
  const correctIdx = state.choices.indexOf(state.current.meaning);

  const levelLabel    = { basic: '🟢 初級', intermediate: '🟡 中級', advanced: '🔴 上級' };
  const categoryLabel = { verb: '動詞', noun: '名詞', adjective: '形容詞', other: 'その他' };

  app.innerHTML = `
    <div class="header">
      <button class="btn-icon" onclick="if(confirm('終了しますか？')){state.screen='home';render()}">← 終了</button>
      <div class="mode-badge ${state.mode === 'mistakes' ? 'mode-mistakes' : 'mode-all'}">
        ${state.mode === 'mistakes' ? '復習' : '全単語'}
      </div>
      <div class="score">${state.stats.correct} / ${state.stats.total}</div>
    </div>

    <div class="progress-bar-wrap">
      <div class="progress-bar" style="width: ${progress}%"></div>
    </div>
    <div class="progress-label">残り ${remaining + (state.answered ? 0 : 1)} 問</div>

    <div class="card word-card">
      <div class="word-tags">
        <span class="tag tag-level">${levelLabel[state.current.level]}</span>
        <span class="tag tag-category">${categoryLabel[state.current.category]}</span>
      </div>
      <div class="word">${state.current.word}</div>
    </div>

    <div class="choices">
      ${state.choices.map((c, i) => {
        let cls = 'choice';
        if (state.answered) {
          if (i === correctIdx)          cls += ' correct';
          else if (i === state.selectedIndex) cls += ' wrong';
          else                           cls += ' dimmed';
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
          <span class="example-label">Example</span>
          <p>${state.current.example}</p>
        </div>
        <button class="btn btn-primary btn-next" onclick="nextQuestion()">次へ →</button>
      </div>
    ` : ''}
  `;
}

function renderResult() {
  const app = document.getElementById('app');
  const { correct, total } = state.stats;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const mistakes = countMistakes();

  app.innerHTML = `
    <div class="card result-card">
      <div class="result-emoji">${pct >= 80 ? '🎉' : pct >= 60 ? '👍' : '💪'}</div>
      <h2>セッション完了！</h2>
      <div class="result-score">${correct} / ${total} 正解</div>
      <div class="result-pct">${pct}%</div>
      <div class="result-stats">
        <div class="stat-item">
          <span class="stat-value learned">${countLearned()}</span>
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
        <button class="btn btn-primary" onclick="startMode('all')">もう一度</button>
        ${mistakes > 0
          ? `<button class="btn btn-warning" onclick="startMode('mistakes')">復習モード（${mistakes}語）</button>`
          : ''}
        <button class="btn btn-ghost" onclick="state.screen='home';render()">ホームへ</button>
        <button class="btn-text" onclick="state.screen='history';render()">📊 スコア履歴を見る</button>
      </div>
    </div>
  `;
}

function renderHistory() {
  const app = document.getElementById('app');
  const h = state.history;

  const modeLabel     = { all: '全単語', mistakes: '復習' };
  const levelLabel    = { all: '全', basic: '初級', intermediate: '中級', advanced: '上級' };
  const categoryLabel = { all: '全', verb: '動詞', noun: '名詞', adjective: '形容詞', other: 'その他' };

  function formatDate(iso) {
    const d = new Date(iso);
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  const graphBars = h.slice(0, 10).reverse().map(r => {
    const color = r.pct >= 80 ? 'var(--success)' : r.pct >= 60 ? 'var(--warning)' : 'var(--danger)';
    const glow  = r.pct >= 80 ? 'var(--success-glow)' : r.pct >= 60 ? 'var(--gold-glow)' : 'var(--danger-glow)';
    return `
      <div class="bar-wrap">
        <div class="bar-pct">${r.pct}%</div>
        <div class="bar-col">
          <div class="bar" style="height:${r.pct}%;background:${color};box-shadow:0 0 8px ${glow}"></div>
        </div>
        <div class="bar-label">${formatDate(r.date)}</div>
      </div>`;
  }).join('');

  const rows = h.map(r => `
    <div class="history-row">
      <div class="history-date">${formatDate(r.date)}</div>
      <div class="history-tags">
        <span class="tag tag-mode">${modeLabel[r.mode] || r.mode}</span>
        <span class="tag tag-lv">${levelLabel[r.level] || r.level}</span>
        <span class="tag tag-cat">${categoryLabel[r.category] || r.category}</span>
        <span class="tag tag-lv">${r.questionCount || r.total}問</span>
      </div>
      <div class="history-score ${r.pct >= 80 ? 'score-good' : r.pct >= 60 ? 'score-mid' : 'score-bad'}">
        ${r.correct}/${r.total} <span class="score-pct">${r.pct}%</span>
      </div>
    </div>`).join('');

  app.innerHTML = `
    <div class="history-screen">
      <div class="header">
        <button class="btn-icon" onclick="state.screen='home';render()">← 戻る</button>
        <h2 style="font-size:17px;font-weight:800">スコア履歴</h2>
        <div></div>
      </div>

      ${h.length === 0 ? `
        <div class="empty-state">
          <div style="font-size:52px;margin-bottom:16px">📊</div>
          <p>まだ記録がありません。<br>クイズを始めてみましょう！</p>
        </div>
      ` : `
        ${h.length >= 2 ? `
          <div class="card graph-card">
            <div class="graph-title">直近 ${Math.min(h.length, 10)} 回の正答率</div>
            <div class="graph">${graphBars}</div>
            <div class="graph-legend">
              <span class="legend-dot" style="background:var(--success)"></span>80%以上
              <span class="legend-dot" style="background:var(--warning);margin-left:8px"></span>60%以上
              <span class="legend-dot" style="background:var(--danger);margin-left:8px"></span>60%未満
            </div>
          </div>
        ` : ''}
        <div class="card"><div class="history-list">${rows}</div></div>
      `}
    </div>
  `;
}

loadStorage();
render();
