'use strict';

// ===== チームカラー =====
const TEAM_COLORS = ['#e85d04','#0077b6','#06d6a0','#7b2d8b','#f4a261','#e63946','#457b9d','#2dc653'];
function teamColor(idx) { return TEAM_COLORS[idx % TEAM_COLORS.length]; }

// ===== データ管理 =====
const DB = {
  load() {
    return {
      members: JSON.parse(localStorage.getItem('bsk_members') || '[]'),
      teams:   JSON.parse(localStorage.getItem('bsk_teams')   || '[]'),
      events:  JSON.parse(localStorage.getItem('bsk_events')  || '[]'),
    };
  },
  save(data) {
    localStorage.setItem('bsk_members', JSON.stringify(data.members));
    localStorage.setItem('bsk_teams',   JSON.stringify(data.teams));
    localStorage.setItem('bsk_events',  JSON.stringify(data.events));
  },
  get members() { return this.load().members; },
  get teams()   { return this.load().teams; },
  get events()  { return this.load().events; },
  saveMembers(v) { const d = this.load(); d.members = v; this.save(d); },
  saveTeams(v)   { const d = this.load(); d.teams   = v; this.save(d); },
  saveEvents(v)  { const d = this.load(); d.events  = v; this.save(d); },
};

// ===== 属性定義 =====
const ATTRS = {
  player:   { label: 'プレイヤー', cls: 'player' },
  beginner: { label: '初心者',     cls: 'beginner' },
  female:   { label: '女性',       cls: 'female' },
};

function applyBonus(attr, delta) {
  if (delta <= 0) return delta; // マイナス操作には補正なし
  if (attr === 'beginner') return delta + 1;
  if (attr === 'female')   return delta * 2;
  return delta;
}

function bonusHintText(attr) {
  if (attr === 'beginner') return '初心者補正：+1/+2/+3 → +2/+3/+4';
  if (attr === 'female')   return '女性補正：+1/+2/+3 → +2/+4/+6';
  return '';
}

// ===== ユーティリティ =====
function uuid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function initial(name) { return name ? name[0].toUpperCase() : '?'; }
function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== 画面遷移 =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  const navMap = {
    home:'nav-home', members:'nav-members',
    'new-event':'nav-game', game:'nav-game',
    history:'nav-history', detail:'nav-history',
    ranking:'nav-ranking',
    agg:'nav-agg',
  };
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navId = navMap[id];
  if (navId) document.getElementById(navId)?.classList.add('active');
}

// ===== トースト =====
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ===== ダイアログ =====
let dialogResolve;
function showDialog(title, message) {
  document.getElementById('dialog-title').textContent   = title;
  document.getElementById('dialog-message').textContent = message;
  document.getElementById('dialog').classList.remove('hidden');
  return new Promise(res => { dialogResolve = res; });
}
function closeDialog(result) {
  document.getElementById('dialog').classList.add('hidden');
  if (dialogResolve) dialogResolve(result);
}

// ===== ホーム =====
function initHome() { showScreen('home'); }

// ===== チーム管理 =====
function renderTeams() {
  const teams   = DB.teams;
  const members = DB.members;
  const list = document.getElementById('team-list');
  if (teams.length === 0) {
    list.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:8px 0;">チームがまだありません。</div>`;
    return;
  }
  list.innerHTML = teams.map((t, i) => {
    const count = members.filter(m => m.teamId === t.id).length;
    return `
      <div class="team-item">
        <div class="team-color-dot" style="background:${teamColor(i)}"></div>
        <span class="team-name-text">${escHtml(t.name)}</span>
        <span class="team-member-count">${count}人</span>
        <button class="member-delete" onclick="deleteTeam('${t.id}')" title="削除">×</button>
      </div>`;
  }).join('');
}

function addTeam() {
  const input = document.getElementById('team-input');
  const name  = input.value.trim();
  if (!name) { showToast('チーム名を入力してください'); return; }
  const teams = DB.teams;
  if (teams.some(t => t.name === name)) { showToast('同じ名前のチームがあります'); return; }
  teams.push({ id: uuid(), name });
  DB.saveTeams(teams);
  input.value = '';
  renderTeams();
  renderMembers();
  showToast(`チーム「${name}」を追加しました`);
}

async function deleteTeam(id) {
  const teams = DB.teams;
  const t = teams.find(t => t.id === id);
  if (!t) return;
  const ok = await showDialog('チームを削除', `「${t.name}」を削除しますか？\nメンバーのチーム割り当ては解除されます。`);
  if (!ok) return;
  DB.saveTeams(teams.filter(x => x.id !== id));
  DB.saveMembers(DB.members.map(m => m.teamId === id ? { ...m, teamId: null } : m));
  renderTeams();
  renderMembers();
  showToast(`チーム「${t.name}」を削除しました`);
}

function assignAttr(memberId, attribute) {
  DB.saveMembers(DB.members.map(m => m.id === memberId ? { ...m, attribute } : m));
  renderMembers();
}

function assignTeam(memberId, teamId) {
  DB.saveMembers(DB.members.map(m => m.id === memberId ? { ...m, teamId: teamId || null } : m));
  renderTeams();
}

// ===== メンバー管理 =====
function renderMembers() {
  const members = DB.members;
  const teams   = DB.teams;
  const list = document.getElementById('member-list');
  if (members.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div>メンバーがいません。</div>`;
    return;
  }
  list.innerHTML = members.map(m => {
    const teamIdx  = teams.findIndex(t => t.id === m.teamId);
    const color    = teamIdx >= 0 ? teamColor(teamIdx) : null;
    const badgeHtml = color
      ? `<span class="team-badge" style="background:${color}">${escHtml(teams[teamIdx].name)}</span>`
      : '';
    const attr = m.attribute || 'player';
    const attrBtns = Object.entries(ATTRS).map(([key, a]) =>
      `<button class="attr-btn ${key === attr ? 'active ' + key : ''}" onclick="assignAttr('${m.id}','${key}')">${a.label}</button>`
    ).join('');
    return `
      <div class="member-item">
        <div class="member-avatar" style="${color ? `background:${color}` : ''}">${initial(m.name)}</div>
        <span class="member-name">${escHtml(m.name)}</span>
        ${badgeHtml}
        <div class="attr-selector">${attrBtns}</div>
        <select class="team-select" onchange="assignTeam('${m.id}', this.value)">
          <option value="">チームなし</option>
          ${teams.map((t, i) => `<option value="${t.id}" ${m.teamId === t.id ? 'selected' : ''}>${escHtml(t.name)}</option>`).join('')}
        </select>
        <button class="member-delete" onclick="deleteMember('${m.id}')" title="削除">×</button>
      </div>`;
  }).join('');
}

function addMember() {
  const input = document.getElementById('member-input');
  const name  = input.value.trim();
  if (!name) { showToast('名前を入力してください'); return; }
  const members = DB.members;
  if (members.some(m => m.name === name)) { showToast('同じ名前のメンバーがいます'); return; }
  members.push({ id: uuid(), name, teamId: null, attribute: 'player' });
  DB.saveMembers(members);
  input.value = '';
  input.focus();
  renderMembers();
  renderTeams();
  showToast(`${name} を追加しました`);
}

async function deleteMember(id) {
  const m = DB.members.find(m => m.id === id);
  if (!m) return;
  const ok = await showDialog('メンバーを削除', `「${m.name}」を削除しますか？`);
  if (!ok) return;
  DB.saveMembers(DB.members.filter(x => x.id !== id));
  renderMembers();
  renderTeams();
  showToast(`${m.name} を削除しました`);
}

function openMemberScreen() {
  renderTeams();
  renderMembers();
  showScreen('members');
  setTimeout(() => document.getElementById('member-input').focus(), 50);
}

// ===== 試合作成（チーム選択） =====
function openNewEventScreen() {
  const teams = DB.teams;
  if (teams.length === 0) {
    showToast('先にチームを作成してください');
    openMemberScreen();
    return;
  }
  document.getElementById('event-name-input').value = '';
  document.getElementById('event-date-input').value = new Date().toISOString().slice(0, 10);
  renderTeamCheckList();
  showScreen('new-event');
}

function renderTeamCheckList() {
  const teams   = DB.teams;
  const members = DB.members;
  const list = document.getElementById('team-check-list');
  list.innerHTML = teams.map((t, i) => {
    const teamMembers = members.filter(m => m.teamId === t.id);
    const memberNames = teamMembers.map(m => escHtml(m.name)).join('、') || 'メンバーなし';
    return `
      <div class="team-check-item" id="tcheck-${t.id}" onclick="toggleTeamCheck('${t.id}')">
        <div class="team-check-box" id="tcheckmark-${t.id}"></div>
        <div class="team-color-dot" style="background:${teamColor(i)};width:16px;height:16px;"></div>
        <div class="team-check-info">
          <div class="team-check-name" style="color:${teamColor(i)}">${escHtml(t.name)}</div>
          <div class="team-check-members">${memberNames}（${teamMembers.length}人）</div>
        </div>
      </div>`;
  }).join('');
  updateMemberPreview();
}

function toggleTeamCheck(id) {
  const item    = document.getElementById('tcheck-' + id);
  const box     = document.getElementById('tcheckmark-' + id);
  const checked = item.classList.toggle('checked');
  box.textContent = checked ? '✓' : '';
  updateMemberPreview();
}

function updateMemberPreview() {
  const teams     = DB.teams;
  const members   = DB.members;
  const checkedIds = teams.filter(t => document.getElementById('tcheck-' + t.id)?.classList.contains('checked')).map(t => t.id);
  const preview   = document.getElementById('member-preview');

  if (checkedIds.length === 0) {
    preview.innerHTML = `<span style="color:var(--text-muted);">チームを選択するとメンバーが表示されます</span>`;
    return;
  }
  const chips = members
    .filter(m => checkedIds.includes(m.teamId))
    .map(m => {
      const idx = teams.findIndex(t => t.id === m.teamId);
      const col = idx >= 0 ? teamColor(idx) : '#888';
      return `<span class="member-preview-chip" style="border-left:3px solid ${col}">${escHtml(m.name)}</span>`;
    });
  preview.innerHTML = chips.length > 0
    ? chips.join('')
    : `<span style="color:var(--text-muted);">選択したチームにメンバーがいません</span>`;
}

function startGame() {
  const name = document.getElementById('event-name-input').value.trim();
  const date = document.getElementById('event-date-input').value;
  if (!name) { showToast('試合名を入力してください'); return; }
  if (!date)  { showToast('日付を選択してください'); return; }

  const teams       = DB.teams;
  const members     = DB.members;
  const selectedTeamIds = teams.filter(t => document.getElementById('tcheck-' + t.id)?.classList.contains('checked')).map(t => t.id);

  if (selectedTeamIds.length < 2) { showToast('チームを2つ以上選択してください'); return; }

  const selectedMembers = members.filter(m => selectedTeamIds.includes(m.teamId));
  if (selectedMembers.length === 0) { showToast('選択したチームにメンバーがいません'); return; }

  const playerStats = {};
  selectedMembers.forEach(m => { playerStats[m.id] = { points: 0, assists: 0, rebounds: 0 }; });

  const event = { id: uuid(), name, date, teamIds: selectedTeamIds, playerStats, finished: false };
  const events = DB.events;
  events.push(event);
  DB.saveEvents(events);
  openGameScreen(event.id);
}

// ===== 試合中 =====
let currentEventId = null;

function openGameScreen(eventId) {
  currentEventId = eventId;
  renderGameScreen();
  showScreen('game');
}

function renderGameScreen() {
  const event   = DB.events.find(e => e.id === currentEventId);
  if (!event) return;
  document.getElementById('game-name').textContent = event.name;
  document.getElementById('game-date').textContent = formatDate(event.date);

  const members = DB.members;
  const teams   = DB.teams;
  const teamIds = event.teamIds || [];

  // スコアボード
  renderScoreboard(event, teams, members, 'scoreboard-area');

  // チームごとにプレイヤーカードをグループ表示
  const gameContent = document.getElementById('game-content');
  gameContent.innerHTML = teamIds.map(tid => {
    const tIdx      = teams.findIndex(t => t.id === tid);
    const team      = teams[tIdx];
    if (!team) return '';
    const color     = teamColor(tIdx);
    const teamPlayers = Object.keys(event.playerStats).filter(pid => {
      const m = members.find(m => m.id === pid);
      return m && m.teamId === tid;
    });
    const cardsHtml = teamPlayers.map(pid => playerCardHtml(pid, event, members, color)).join('');
    return `
      <div class="team-section-header" style="color:${color}">${escHtml(team.name)}</div>
      <div class="player-group"><div class="player-grid">${cardsHtml}</div></div>`;
  }).join('');
}

function renderScoreboard(event, teams, members, containerId) {
  const teamIds = event.teamIds || [];
  if (teamIds.length < 2) { document.getElementById(containerId).innerHTML = ''; return; }

  const scores = teamIds.map(tid => {
    const pts = Object.entries(event.playerStats)
      .filter(([pid]) => { const m = members.find(m => m.id === pid); return m && m.teamId === tid; })
      .reduce((sum, [, s]) => sum + s.points, 0);
    const tIdx = teams.findIndex(t => t.id === tid);
    return { tid, name: teams[tIdx]?.name || '?', pts, color: teamColor(tIdx) };
  });

  const parts = scores.map(s =>
    `<div class="score-team">
       <div class="score-team-name" style="color:${s.color}">${escHtml(s.name)}</div>
       <div class="score-team-pts" style="color:${s.color}" id="score-${s.tid}">${s.pts}</div>
     </div>`
  ).join('<div class="score-vs">VS</div>');

  document.getElementById(containerId).innerHTML = `<div class="scoreboard">${parts}</div>`;
}

function playerCardHtml(pid, event, members, teamColor) {
  const member = members.find(m => m.id === pid);
  if (!member) return '';
  const s    = event.playerStats[pid];
  const attr = member.attribute || 'player';
  const hint = bonusHintText(attr);
  const attrDef = ATTRS[attr];

  // ボタンに実効値を表示
  const ptLabels = [1, 2, 3].map(base => {
    const eff = applyBonus(attr, base);
    return eff !== base ? `+${base}<span style="font-size:9px;opacity:0.8">(${eff})</span>` : `+${base}`;
  });

  return `
    <div class="player-card">
      <div class="player-card-header">
        <div class="member-avatar" style="background:${teamColor}">${initial(member.name)}</div>
        <span class="player-card-name">${escHtml(member.name)}</span>
        <span class="attr-badge ${attr}">${attrDef.label}</span>
      </div>
      <div class="stat-row">
        <div class="stat-box">
          <span class="stat-label">得点</span>
          <span class="stat-value" id="pts-${pid}">${s.points}</span>
          <div class="stat-controls">
            <button class="stat-btn pt1" onclick="addStat('${pid}','points',1)">${ptLabels[0]}</button>
            <button class="stat-btn pt2" onclick="addStat('${pid}','points',2)">${ptLabels[1]}</button>
            <button class="stat-btn pt3" onclick="addStat('${pid}','points',3)">${ptLabels[2]}</button>
            <button class="stat-btn minus" onclick="addStat('${pid}','points',-1)">−</button>
          </div>
          ${hint ? `<div class="bonus-hint ${attr}">${hint}</div>` : ''}
        </div>
        <div class="stat-box">
          <span class="stat-label">アシスト</span>
          <span class="stat-value" id="ast-${pid}">${s.assists}</span>
          <div class="stat-controls">
            <button class="stat-btn plus"  onclick="addStat('${pid}','assists',1)">+1</button>
            <button class="stat-btn minus" onclick="addStat('${pid}','assists',-1)">−</button>
          </div>
        </div>
        <div class="stat-box">
          <span class="stat-label">リバウンド</span>
          <span class="stat-value" id="reb-${pid}">${s.rebounds}</span>
          <div class="stat-controls">
            <button class="stat-btn plus"  onclick="addStat('${pid}','rebounds',1)">+1</button>
            <button class="stat-btn minus" onclick="addStat('${pid}','rebounds',-1)">−</button>
          </div>
        </div>
      </div>
    </div>`;
}

function addStat(playerId, stat, delta) {
  const events = DB.events;
  const event  = events.find(e => e.id === currentEventId);
  if (!event) return;

  // 得点のみ属性補正を適用
  if (stat === 'points') {
    const member = DB.members.find(m => m.id === playerId);
    delta = applyBonus(member?.attribute || 'player', delta);
  }

  event.playerStats[playerId][stat] = Math.max(0, event.playerStats[playerId][stat] + delta);
  DB.saveEvents(events);

  const elMap = { points:'pts', assists:'ast', rebounds:'reb' };
  const el = document.getElementById(`${elMap[stat]}-${playerId}`);
  if (el) {
    el.textContent     = event.playerStats[playerId][stat];
    el.style.transform = 'scale(1.4)';
    setTimeout(() => { el.style.transform = ''; }, 160);
  }

  // スコアボードをリアルタイム更新
  if (stat === 'points') {
    const members = DB.members;
    const teams   = DB.teams;
    (event.teamIds || []).forEach(tid => {
      const scoreEl = document.getElementById('score-' + tid);
      if (!scoreEl) return;
      const pts = Object.entries(event.playerStats)
        .filter(([pid]) => { const m = members.find(m => m.id === pid); return m && m.teamId === tid; })
        .reduce((sum, [, s]) => sum + s.points, 0);
      scoreEl.textContent = pts;
    });
  }
}

async function endGame() {
  const ok = await showDialog('試合を終了', '試合を終了してスタッツを確定しますか？');
  if (!ok) return;
  const events = DB.events;
  const event  = events.find(e => e.id === currentEventId);
  if (event) { event.finished = true; DB.saveEvents(events); }
  openHistoryScreen();
  showToast('試合を終了しました');
}

// ===== 履歴 =====
function openHistoryScreen() {
  const events = DB.events.slice().reverse();
  const list   = document.getElementById('event-list');
  if (events.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div>試合の記録がありません。</div>`;
  } else {
    const members = DB.members;
    const teams   = DB.teams;
    list.innerHTML = events.map(e => {
      const badge = e.finished
        ? '<span class="event-badge">終了</span>'
        : '<span class="event-badge ongoing">進行中</span>';
      const teamNames = (e.teamIds || []).map(tid => {
        const tIdx = teams.findIndex(t => t.id === tid);
        return tIdx >= 0 ? `<span style="color:${teamColor(tIdx)};font-weight:700;">${escHtml(teams[tIdx].name)}</span>` : '';
      }).filter(Boolean).join(' vs ');
      return `
        <div class="event-row" onclick="openEventDetail('${e.id}')">
          <div>
            <div class="event-row-name">${escHtml(e.name)}</div>
            <div class="event-row-date">${formatDate(e.date)}　${teamNames}</div>
          </div>
          <div class="event-row-members">${Object.keys(e.playerStats).length}人参加</div>
          ${badge}
          <span style="color:var(--text-muted);font-size:18px;">›</span>
        </div>`;
    }).join('');
  }
  showScreen('history');
}

// ===== 試合詳細 =====
function openEventDetail(eventId) {
  currentEventId = eventId;
  const event   = DB.events.find(e => e.id === eventId);
  if (!event) return;
  const members = DB.members;
  const teams   = DB.teams;

  document.getElementById('detail-name').textContent = event.name;
  document.getElementById('detail-date').textContent =
    formatDate(event.date) + (event.finished ? '　（終了）' : '　（進行中）');

  // スコアボード
  renderScoreboard(event, teams, members, 'detail-scoreboard');

  // スタッツ表（チーム別グループ）
  const teamIds = event.teamIds || [];
  let rows = '';
  if (teamIds.length > 0) {
    teamIds.forEach(tid => {
      const tIdx = teams.findIndex(t => t.id === tid);
      const col  = tIdx >= 0 ? teamColor(tIdx) : '#888';
      const tName = tIdx >= 0 ? teams[tIdx].name : '不明';
      const teamPids = Object.keys(event.playerStats).filter(pid => {
        const m = members.find(m => m.id === pid);
        return m && m.teamId === tid;
      });
      if (teamPids.length === 0) return;
      rows += `<div class="stats-table-row" style="background:rgba(0,0,0,0.2);">
        <div class="stat-cell name" style="color:${col};font-weight:800;">${escHtml(tName)}</div>
        <div></div><div></div><div></div>
      </div>`;
      teamPids.forEach(pid => {
        const m = members.find(m => m.id === pid);
        const s = event.playerStats[pid];
        rows += `<div class="stats-table-row">
          <div class="stat-cell name" style="padding-left:20px;">${escHtml(m ? m.name : '不明')}</div>
          <div class="stat-cell">${s.points}</div>
          <div class="stat-cell">${s.assists}</div>
          <div class="stat-cell">${s.rebounds}</div>
        </div>`;
      });
    });
  } else {
    rows = Object.keys(event.playerStats).map(pid => {
      const m = members.find(m => m.id === pid);
      const s = event.playerStats[pid];
      return `<div class="stats-table-row">
        <div class="stat-cell name">${escHtml(m ? m.name : '不明')}</div>
        <div class="stat-cell">${s.points}</div>
        <div class="stat-cell">${s.assists}</div>
        <div class="stat-cell">${s.rebounds}</div>
      </div>`;
    }).join('');
  }
  document.getElementById('detail-stats').innerHTML = rows;

  document.getElementById('resume-btn-placeholder').innerHTML = !event.finished
    ? `<button class="btn btn-primary" onclick="openGameScreen('${event.id}')">▶ 試合を再開</button>`
    : '';
  showScreen('detail');
}

async function deleteEvent() {
  const event = DB.events.find(e => e.id === currentEventId);
  if (!event) return;
  const ok = await showDialog('試合を削除', `「${event.name}」を削除しますか？この操作は取り消せません。`);
  if (!ok) return;
  DB.saveEvents(DB.events.filter(e => e.id !== currentEventId));
  openHistoryScreen();
  showToast('試合を削除しました');
}

// ===== チーム順位 =====
function openRankingScreen() {
  const teams   = DB.teams;
  const members = DB.members;
  const events  = DB.events.filter(e => e.finished && (e.teamIds || []).length >= 2);

  // チームごとの集計
  const stats = {}; // { teamId: { w, d, l, pts_for, pts_against, rp } }
  teams.forEach(t => {
    stats[t.id] = { w: 0, d: 0, l: 0, ptsFor: 0, ptsAgainst: 0 };
  });

  events.forEach(e => {
    const teamIds = e.teamIds;
    // チームごとの得点合計
    const teamScores = {};
    teamIds.forEach(tid => {
      teamScores[tid] = Object.entries(e.playerStats)
        .filter(([pid]) => { const m = members.find(m => m.id === pid); return m && m.teamId === tid; })
        .reduce((sum, [, s]) => sum + s.points, 0);
    });

    if (teamIds.length === 2) {
      const [t1, t2] = teamIds;
      const s1 = teamScores[t1] ?? 0;
      const s2 = teamScores[t2] ?? 0;
      if (!stats[t1] || !stats[t2]) return;
      stats[t1].ptsFor     += s1; stats[t1].ptsAgainst += s2;
      stats[t2].ptsFor     += s2; stats[t2].ptsAgainst += s1;
      if (s1 > s2)      { stats[t1].w++; stats[t2].l++; }
      else if (s2 > s1) { stats[t2].w++; stats[t1].l++; }
      else              { stats[t1].d++; stats[t2].d++; }
    } else {
      // 3チーム以上：最高得点→勝、最低得点→負、それ以外→引き分け
      const sorted = [...teamIds].sort((a, b) => (teamScores[b] ?? 0) - (teamScores[a] ?? 0));
      const maxPts = teamScores[sorted[0]] ?? 0;
      const minPts = teamScores[sorted[sorted.length - 1]] ?? 0;
      teamIds.forEach(tid => {
        if (!stats[tid]) return;
        const sp = teamScores[tid] ?? 0;
        stats[tid].ptsFor += sp;
        stats[tid].ptsAgainst += teamIds.filter(x => x !== tid).reduce((s, x) => s + (teamScores[x] ?? 0), 0);
        if (sp === maxPts && maxPts !== minPts) stats[tid].w++;
        else if (sp === minPts && maxPts !== minPts) stats[tid].l++;
        else stats[tid].d++;
      });
    }
  });

  // 勝ち点 = W×3 + D×1
  const ranked = teams.map((t, i) => {
    const s  = stats[t.id] || { w:0, d:0, l:0, ptsFor:0, ptsAgainst:0 };
    const rp = s.w * 3 + s.d;
    const gp = s.w + s.d + s.l;
    const diff = s.ptsFor - s.ptsAgainst;
    return { ...t, idx: i, ...s, rp, gp, diff };
  }).sort((a, b) => b.rp - a.rp || b.diff - a.diff || b.ptsFor - a.ptsFor);

  // 順位テーブル
  const rankNumClass = ['gold','silver','bronze'];
  const rows = ranked.map((t, rank) => {
    const cls = rank < 3 ? rankNumClass[rank] : '';
    return `
      <div class="ranking-row">
        <div class="rank-num ${cls}">${rank + 1}</div>
        <div class="rank-name">
          <div class="team-color-dot" style="background:${teamColor(t.idx)}"></div>
          ${escHtml(t.name)}
        </div>
        <div class="rank-cell">${t.gp}</div>
        <div class="rank-cell win">${t.w}</div>
        <div class="rank-cell draw">${t.d}</div>
        <div class="rank-cell loss">${t.l}</div>
        <div class="rank-cell">${t.diff >= 0 ? '+' : ''}${t.diff}</div>
        <div class="rank-cell pts-col">${t.rp}</div>
      </div>`;
  }).join('');

  const tableHtml = teams.length === 0
    ? `<div class="empty-state"><div class="empty-icon">🏆</div>チームがありません。</div>`
    : `<div class="ranking-table">
        <div class="ranking-header">
          <div></div>
          <div>チーム</div>
          <div style="text-align:center">試合</div>
          <div style="text-align:center;color:var(--success)">勝</div>
          <div style="text-align:center">分</div>
          <div style="text-align:center;color:var(--danger)">負</div>
          <div style="text-align:center">得失点差</div>
          <div style="text-align:center;color:var(--orange-light)">勝ち点</div>
        </div>
        ${rows}
      </div>`;

  // 対戦結果一覧
  const matchRows = events.slice().reverse().map(e => {
    const teamIds = e.teamIds;
    const scores  = teamIds.map(tid => {
      const tIdx  = teams.findIndex(t => t.id === tid);
      const pts   = Object.entries(e.playerStats)
        .filter(([pid]) => { const m = members.find(m => m.id === pid); return m && m.teamId === tid; })
        .reduce((sum, [, s]) => sum + s.points, 0);
      return { name: tIdx >= 0 ? teams[tIdx].name : '?', pts, color: teamColor(tIdx) };
    });
    const resultParts = scores.map(s =>
      `<span style="color:${s.color};font-weight:700;">${escHtml(s.name)}</span> ${s.pts}点`
    ).join(' ／ ');
    return `<div class="event-row" onclick="openEventDetail('${e.id}')">
      <div>
        <div class="event-row-name">${escHtml(e.name)}</div>
        <div class="event-row-date">${formatDate(e.date)}　${resultParts}</div>
      </div>
      <span class="event-badge">終了</span>
      <span style="color:var(--text-muted);font-size:18px;">›</span>
    </div>`;
  }).join('');

  document.getElementById('ranking-table-area').innerHTML = tableHtml;
  document.getElementById('ranking-match-list').innerHTML = events.length > 0
    ? `<div class="section-title" style="margin-bottom:12px;">対戦結果</div><div class="event-list">${matchRows}</div>`
    : '';

  showScreen('ranking');
}

// ===== スタッツ集計 =====
function openAggScreen() {
  const events = DB.events.slice().reverse();
  const list   = document.getElementById('agg-event-list');
  if (events.length === 0) {
    list.innerHTML = `<div style="color:var(--text-muted);font-size:13px;">試合の記録がありません。</div>`;
  } else {
    const teams = DB.teams;
    list.innerHTML = events.map(e => {
      const teamNames = (e.teamIds || []).map(tid => {
        const tIdx = teams.findIndex(t => t.id === tid);
        return tIdx >= 0 ? teams[tIdx].name : '';
      }).filter(Boolean).join(' vs ');
      return `
        <div class="agg-event-item" id="agg-check-${e.id}" onclick="toggleAggEvent('${e.id}')">
          <div class="check-box" id="agg-checkmark-${e.id}"></div>
          <div style="flex:1;min-width:0;">
            <div class="agg-event-name">${escHtml(e.name)}</div>
            <div class="agg-event-date">${formatDate(e.date)}${teamNames ? '　' + escHtml(teamNames) : ''}</div>
          </div>
        </div>`;
    }).join('');
  }
  document.getElementById('agg-result').innerHTML = `
    <div class="agg-placeholder">
      <div class="agg-placeholder-icon">📊</div>
      <div>左の一覧から試合を選択して<br>「集計する」ボタンを押してください</div>
    </div>`;
  showScreen('agg');
}

function toggleAggEvent(id) {
  const item = document.getElementById('agg-check-' + id);
  const box  = document.getElementById('agg-checkmark-' + id);
  const checked = item.classList.toggle('checked');
  box.textContent = checked ? '✓' : '';
}

function calcAgg() {
  const selected = DB.events.filter(e => document.getElementById('agg-check-' + e.id)?.classList.contains('checked'));
  if (selected.length === 0) { showToast('試合を1つ以上選択してください'); return; }

  const members = DB.members;
  const teams   = DB.teams;
  const totals  = {};
  selected.forEach(e => {
    Object.entries(e.playerStats).forEach(([pid, s]) => {
      if (!totals[pid]) totals[pid] = { points: 0, assists: 0, rebounds: 0, games: 0 };
      totals[pid].points   += s.points;
      totals[pid].assists  += s.assists;
      totals[pid].rebounds += s.rebounds;
      totals[pid].games++;
    });
  });

  const sorted = Object.entries(totals).sort((a, b) => b[1].points - a[1].points);
  const rows = sorted.map(([pid, t]) => {
    const member  = members.find(m => m.id === pid);
    const tIdx    = member ? teams.findIndex(tm => tm.id === member.teamId) : -1;
    const col     = tIdx >= 0 ? teamColor(tIdx) : null;
    const tName   = tIdx >= 0 ? teams[tIdx].name : null;
    const nameCell = member
      ? `${escHtml(member.name)}${tName ? `　<span class="team-badge" style="background:${col};font-size:10px;">${escHtml(tName)}</span>` : ''}`
      : '不明';
    return `<div class="stats-table-row">
      <div class="stat-cell name">${nameCell}　<span style="color:var(--text-muted);font-size:12px;">${t.games}試合</span></div>
      <div class="stat-cell total">${t.points}</div>
      <div class="stat-cell total">${t.assists}</div>
      <div class="stat-cell total">${t.rebounds}</div>
    </div>`;
  }).join('');

  document.getElementById('agg-result').innerHTML = `
    <div style="margin-bottom:14px;">
      <div style="font-size:13px;color:var(--text-muted);">${selected.length}試合を集計（得点順）</div>
    </div>
    <div class="stats-table">
      <div class="stats-table-header">
        <div>選手</div>
        <div style="text-align:center">得点合計</div>
        <div style="text-align:center">アシスト合計</div>
        <div style="text-align:center">リバウンド合計</div>
      </div>
      ${rows}
    </div>`;
}

// ===== キーボード =====
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('member-input').addEventListener('keydown', e => { if (e.key === 'Enter') addMember(); });
  document.getElementById('team-input').addEventListener('keydown',   e => { if (e.key === 'Enter') addTeam(); });
  document.getElementById('event-name-input').addEventListener('keydown', e => { if (e.key === 'Enter') startGame(); });
});
