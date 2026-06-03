const STORAGE_KEY = 'toeic_quiz_progress';
const HISTORY_KEY = 'toeic_quiz_history';
const STREAK_KEY  = 'toeic_quiz_streak';

let state = {
  mode: 'all',
  filterLevel: 'all',
  filterCategory: 'all',
  questionCount: 20,
  queue: [],
  current: null,
  choices: [],
  answered: false,
  selectedIndex: null,
  stats: { correct: 0, total: 0 },
  consecutiveCorrect: 0,   // 連続正解数（セッション内）
  progress: {},            // { word: { seen, correct, correctCount, totalCount } }
  history: [],
  streak: { days: 0, lastDate: null },
  screen: 'home',          // 'home' | 'quiz' | 'result' | 'history' | 'words'
};

// ── Storage ───────────────────────────────────────────

function loadStorage() {
  try {
    const p = localStorage.getItem(STORAGE_KEY);
    if (p) state.progress = JSON.parse(p);
    const h = localStorage.getItem(HISTORY_KEY);
    if (h) state.history = JSON.parse(h);
    const s = localStorage.getItem(STREAK_KEY);
    if (s) state.streak = JSON.parse(s);
  } catch (e) {}
}

function saveProgress() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); }
function saveHistory()  { localStorage.setItem(HISTORY_KEY,  JSON.stringify(state.history));  }
function saveStreak()   { localStorage.setItem(STREAK_KEY,   JSON.stringify(state.streak));   }

// 今日の日付文字列 "YYYY-MM-DD"
function today() {
  return new Date().toISOString().slice(0, 10);
}

// 学習日ストリークを更新（初回解答時に呼ぶ）
function touchStreak() {
  const t = today();
  const { lastDate, days } = state.streak;
  if (lastDate === t) return; // 今日すでにカウント済み

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  state.streak = {
    days: lastDate === yesterday ? days + 1 : 1,
    lastDate: t,
  };
  saveStreak();
}

// ── Helpers ───────────────────────────────────────────

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
    const lvlOk = state.filterLevel    === 'all' || w.level    === state.filterLevel;
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
  state.consecutiveCorrect = 0;
  return true;
}

function nextQuestion() {
  if (state.queue.length === 0) { finishSession(); return; }
  state.current       = state.queue.pop();
  state.answered      = false;
  state.selectedIndex = null;
  state.screen        = 'quiz';
  const wrongPool     = WORDS.filter(w => w.word !== state.current.word);
  const wrongs        = shuffle(wrongPool).slice(0, 3).map(w => w.meaning);
  state.choices       = shuffle([state.current.meaning, ...wrongs]);
  render();
}

function answer(index) {
  if (state.answered) return;
  state.answered      = true;
  state.selectedIndex = index;
  state.stats.total++;

  // 初回解答時にストリーク更新
  if (state.stats.total === 1) touchStreak();

  const isCorrect = state.choices[index] === state.current.meaning;
  const prev = state.progress[state.current.word] || { correctCount: 0, totalCount: 0 };
  state.progress[state.current.word] = {
    seen: true,
    correct: isCorrect,
    correctCount: (prev.correctCount || 0) + (isCorrect ? 1 : 0),
    totalCount:   (prev.totalCount   || 0) + 1,
  };

  if (isCorrect) {
    state.stats.correct++;
    state.consecutiveCorrect++;
  } else {
    state.consecutiveCorrect = 0;
  }

  saveProgress();
  render();
}

function finishSession() {
  const pct = state.stats.total > 0 ? Math.round((state.stats.correct / state.stats.total) * 100) : 0;
  state.history = [{
    date: new Date().toISOString(),
    mode: state.mode,
    level: state.filterLevel,
    category: state.filterCategory,
    correct: state.stats.correct,
    total: state.stats.total,
    pct,
  }, ...state.history].slice(0, 30);
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
  if (!buildQueue()) {
    alert(mode === 'mistakes'
      ? '現在のフィルター条件で間違えた単語がありません。'
      : '条件に一致する単語がありません。フィルターを変更してください。');
    return;
  }
  nextQuestion();
}

function setFilter(type, value) {
  if (type === 'level')    state.filterLevel    = value;
  if (type === 'category') state.filterCategory = value;
  if (type === 'count')    state.questionCount  = Number(value);
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

// ── Render helpers ────────────────────────────────────

function render() {
  if (state.screen === 'home')    { renderHome();    return; }
  if (state.screen === 'quiz')    { renderQuiz();    return; }
  if (state.screen === 'result')  { renderResult();  return; }
  if (state.screen === 'history') { renderHistory(); return; }
  if (state.screen === 'words')   { renderWords();   return; }
}

function chips(type, options, current) {
  return options.map(o => `
    <button class="chip ${String(current) === String(o.value) ? 'chip-active' : ''}"
      onclick="setFilter('${type}','${o.value}')">
      ${o.label}
    </button>`).join('');
}

// クイズ以外の画面で使うボトムナビ
function bottomNav() {
  const tabs = [
    { id: 'home',    icon: '🏠', label: 'ホーム'  },
    { id: 'words',   icon: '📝', label: '単語帳'  },
    { id: 'history', icon: '📊', label: '履歴'    },
  ];
  return `
    <nav class="bottom-nav">
      ${tabs.map(t => `
        <button class="nav-item ${state.screen === t.id ? 'nav-active' : ''}"
          onclick="state.screen='${t.id}';render()">
          <span class="nav-icon">${t.icon}</span>
          <span class="nav-label">${t.label}</span>
        </button>`).join('')}
    </nav>`;
}

// ── Screens ───────────────────────────────────────────

function renderHome() {
  const app      = document.getElementById('app');
  const mistakes = countMistakes();
  const learned  = countLearned();
  const filtered = getFilteredWords();
  const available = state.questionCount === 0
    ? filtered.length
    : Math.min(state.questionCount, filtered.length);
  const { days } = state.streak;

  const levelOpts = [
    { value: 'all', label: 'すべて' },
    { value: '600', label: '600点'  },
    { value: '730', label: '730点'  },
    { value: '860', label: '860点'  },
    { value: '990', label: '990点'  },
  ];
  const categoryOpts = [
    { value: 'all',       label: 'すべて' },
    { value: 'verb',      label: '動詞'   },
    { value: 'noun',      label: '名詞'   },
    { value: 'adjective', label: '形容詞' },
    { value: 'other',     label: 'その他' },
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
    <div class="screen-home">
      <div class="home-title">
        <div class="home-icon">📖</div>
        <h1>TOEIC 単語クイズ</h1>
      </div>

      ${days > 0 ? `
        <div class="streak-banner">
          <span class="streak-flame">🔥</span>
          <div>
            <div class="streak-days">${days}日連続</div>
            <div class="streak-sub">学習中！この調子で続けよう</div>
          </div>
        </div>` : ''}

      <div class="home-stats">
        <div class="stat-item">
          <span class="stat-value learned">${learned}</span>
          <span class="stat-label">習得済み</span>
        </div>
        <div class="stat-item">
          <span class="stat-value mistake">${mistakes}</span>
          <span class="stat-label">要復習</span>
        </div>
      </div>

      <div class="filter-section">
        <div class="filter-label">問題数</div>
        <div class="chips">${chips('count', countOpts, state.questionCount)}</div>
        <div class="filter-label filter-spacer">目標スコア</div>
        <div class="chips">${chips('level', levelOpts, state.filterLevel)}</div>
        <div class="filter-label filter-spacer">品詞</div>
        <div class="chips">${chips('category', categoryOpts, state.filterCategory)}</div>
        <div class="filter-count">対象 <strong>${available}問</strong>（${filtered.length}語中）</div>
      </div>

      <div class="btn-group">
        <button class="btn btn-primary btn-lg" onclick="startMode('all')">スタート</button>
        <button class="btn btn-warning btn-lg ${mistakes === 0 ? 'btn-disabled' : ''}"
          onclick="${mistakes > 0 ? "startMode('mistakes')" : ''}">
          復習モード（${mistakes}語）
        </button>
      </div>

      ${learned > 0 || mistakes > 0
        ? `<div style="text-align:center">
            <button class="btn-text danger" onclick="resetProgress()">履歴リセット</button>
           </div>`
        : ''}
    </div>
    ${bottomNav()}`;
}

function renderQuiz() {
  const app        = document.getElementById('app');
  const remaining  = state.queue.length;
  const done       = state.stats.total;
  const total      = done + remaining + (state.answered ? 0 : 1);
  const progress   = total > 0 ? Math.round((done / total) * 100) : 0;
  const correctIdx = state.choices.indexOf(state.current.meaning);
  const cc         = state.consecutiveCorrect;

  const levelLabel    = { '600': '600点', '730': '730点', '860': '860点', '990': '990点' };
  const categoryLabel = { verb: '動詞', noun: '名詞', adjective: '形容詞', other: 'その他' };

  const streakBadge = cc >= 2
    ? `<div class="quiz-streak">🔥 ${cc}連続正解</div>`
    : '';

  const feedbackHtml = state.answered ? (() => {
    const isCorrect = state.choices[state.selectedIndex] === state.current.meaning;
    return `
      <div class="feedback-card ${isCorrect ? 'feedback-correct' : 'feedback-wrong'}">
        <div class="feedback-header">
          <div class="feedback-label">${isCorrect ? '正解！' : '不正解'}</div>
          <div class="feedback-answer">
            ${isCorrect ? '' : '<span class="feedback-answer-hint">正解：</span>'}
            <strong>${state.current.meaning}</strong>
          </div>
        </div>
        <div class="feedback-body">
          <div class="feedback-example">
            <span class="example-label">Example Phrase</span>
            <p class="example-en">${state.current.example}</p>
            <p class="example-ja">${state.current.exampleJa}</p>
          </div>
          <button class="btn btn-primary" onclick="nextQuestion()">次へ →</button>
        </div>
      </div>`;
  })() : '';

  app.innerHTML = `
    <div class="screen-quiz">
      <div class="quiz-header">
        <button class="btn-icon" onclick="if(confirm('終了しますか？')){state.screen='home';render()}">← 終了</button>
        <div class="quiz-header-center">
          <div class="mode-badge ${state.mode === 'mistakes' ? 'mode-mistakes' : 'mode-all'}">
            ${state.mode === 'mistakes' ? '復習' : '全単語'}
          </div>
          ${streakBadge}
        </div>
        <div class="score">${state.stats.correct}<span class="score-sep">/</span>${state.stats.total}</div>
      </div>

      <div class="progress-bar-wrap">
        <div class="progress-bar" style="width:${progress}%"></div>
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
            if (i === correctIdx)               cls += ' correct';
            else if (i === state.selectedIndex) cls += ' wrong';
            else                                cls += ' dimmed';
          }
          return `<button class="${cls}" onclick="answer(${i})" ${state.answered ? 'disabled' : ''}>${c}</button>`;
        }).join('')}
      </div>

      ${feedbackHtml}
    </div>`;
}

function renderResult() {
  const app      = document.getElementById('app');
  const { correct, total } = state.stats;
  const pct      = total > 0 ? Math.round((correct / total) * 100) : 0;
  const mistakes = countMistakes();
  const { days } = state.streak;

  app.innerHTML = `
    <div class="screen-result">
      <div class="card result-card">
        <div class="result-emoji">${pct >= 80 ? '🎉' : pct >= 60 ? '👍' : '💪'}</div>
        <h2>セッション完了</h2>
        <div class="result-score">${correct} / ${total}</div>
        <div class="result-pct">${pct}%</div>

        ${days > 0 ? `
          <div class="result-streak">
            🔥 ${days}日連続学習中
          </div>` : ''}

        <div class="result-stats">
          <div class="stat-item">
            <span class="stat-value learned">${countLearned()}</span>
            <span class="stat-label">習得済み</span>
          </div>
          <div class="stat-item">
            <span class="stat-value mistake">${mistakes}</span>
            <span class="stat-label">要復習</span>
          </div>
          </div>

        <div class="btn-group">
          <button class="btn btn-primary" onclick="startMode('all')">もう一度</button>
          ${mistakes > 0
            ? `<button class="btn btn-warning" onclick="startMode('mistakes')">復習モード（${mistakes}語）</button>`
            : ''}
          <button class="btn btn-ghost" onclick="state.screen='home';render()">ホームへ</button>
        </div>
      </div>
    </div>
    ${bottomNav()}`;
}

function renderWords() {
  const app = document.getElementById('app');

  // 挑戦済みの単語を正答率でソート（低い順）
  const attempted = WORDS
    .filter(w => state.progress[w.word]?.totalCount > 0)
    .map(w => {
      const p = state.progress[w.word];
      const pct = Math.round((p.correctCount / p.totalCount) * 100);
      return { ...w, correctCount: p.correctCount, totalCount: p.totalCount, pct, correct: p.correct };
    })
    .sort((a, b) => a.pct - b.pct);

  const total = attempted.length;
  const mastered = attempted.filter(w => w.pct === 100).length;
  const struggling = attempted.filter(w => w.pct < 50).length;

  const levelLabel    = { '600': '600点', '730': '730点', '860': '860点', '990': '990点' };
  const categoryLabel = { verb: '動詞', noun: '名詞', adjective: '形容詞', other: 'その他' };

  const rows = attempted.length === 0
    ? `<div class="empty-state">
        <div style="font-size:48px;margin-bottom:16px">📝</div>
        <p>まだ挑戦した単語がありません。<br>クイズを始めてみましょう。</p>
       </div>`
    : attempted.map(w => {
        const barColor = w.pct >= 80 ? 'var(--success)' : w.pct >= 50 ? 'var(--warning)' : 'var(--danger)';
        return `
          <div class="word-row">
            <div class="word-row-main">
              <div class="word-row-word">${w.word}</div>
              <div class="word-row-meaning">${w.meaning}</div>
            </div>
            <div class="word-row-tags">
              <span class="tag tag-level">${levelLabel[w.level]}</span>
              <span class="tag tag-category">${categoryLabel[w.category]}</span>
            </div>
            <div class="word-row-stats">
              <div class="word-row-bar-wrap">
                <div class="word-row-bar" style="width:${w.pct}%;background:${barColor}"></div>
              </div>
              <div class="word-row-pct" style="color:${barColor}">${w.pct}%</div>
              <div class="word-row-count">${w.correctCount}/${w.totalCount}</div>
            </div>
          </div>`;
      }).join('');

  app.innerHTML = `
    <div class="screen-words">
      <div class="page-header">
        <h2>単語帳</h2>
        <p class="page-sub">挑戦済み ${total}語 · 苦手 ${struggling}語 · 完璧 ${mastered}語</p>
      </div>

      <div class="card words-card">
        ${rows}
      </div>
    </div>
    ${bottomNav()}`;
}

function renderHistory() {
  const app = document.getElementById('app');
  const h   = state.history;

  const modeLabel     = { all: '全単語', mistakes: '復習' };
  const levelLabel    = { all: '全', basic: '初級', intermediate: '中級', advanced: '上級' };
  const categoryLabel = { all: '全', verb: '動詞', noun: '名詞', adjective: '形容詞', other: 'その他' };

  const fmt = iso => {
    const d = new Date(iso);
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const graphBars = h.slice(0, 10).reverse().map(r => {
    const color = r.pct >= 80 ? 'var(--success)' : r.pct >= 60 ? 'var(--warning)' : 'var(--danger)';
    return `
      <div class="bar-wrap">
        <div class="bar-pct">${r.pct}%</div>
        <div class="bar-col">
          <div class="bar" style="height:${r.pct}%;background:${color}"></div>
        </div>
        <div class="bar-label">${fmt(r.date)}</div>
      </div>`;
  }).join('');

  const rows = h.map(r => `
    <div class="history-row">
      <div class="history-date">${fmt(r.date)}</div>
      <div class="history-tags">
        <span class="tag tag-mode">${modeLabel[r.mode] || r.mode}</span>
        <span class="tag tag-lv">${levelLabel[r.level] || r.level}</span>
        <span class="tag tag-cat">${categoryLabel[r.category] || r.category}</span>
        <span class="tag tag-lv">${r.total}問</span>
      </div>
      <div class="history-score ${r.pct >= 80 ? 'score-good' : r.pct >= 60 ? 'score-mid' : 'score-bad'}">
        ${r.correct}/${r.total} <span class="score-pct">${r.pct}%</span>
      </div>
    </div>`).join('');

  app.innerHTML = `
    <div class="screen-history">
      <div class="page-header">
        <h2>スコア履歴</h2>
      </div>

      ${h.length === 0 ? `
        <div class="empty-state">
          <div style="font-size:48px;margin-bottom:16px">📊</div>
          <p>まだ記録がありません。<br>クイズを始めてみましょう。</p>
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
          </div>` : ''}
        <div class="card"><div class="history-list">${rows}</div></div>
      `}
    </div>
    ${bottomNav()}`;
}

loadStorage();
render();
