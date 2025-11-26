/* ============================================
   FANTACALCIO WRAPPED - APP LOGIC
   ============================================ */

// ============ CONFIGURATION ============
const CONFIG = {
  SUPABASE_URL: 'https://wsepkexxszwxjlcwwcbu.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZXBrZXh4c3p3eGpsY3d3Y2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMTE2MjAsImV4cCI6MjA3OTY4NzYyMH0.ZmJmwt6NqdgPf1ymVKHaWBjOfFugbk1W-eC29ugjhY8',
  GET_ROSTERS_URL: 'https://wsepkexxszwxjlcwwcbu.supabase.co/functions/v1/get-rosters',
  GET_WRAPPED_URL: 'https://wsepkexxszwxjlcwwcbu.supabase.co/functions/v1/get-wrapped',
};

// Headers per le chiamate Supabase
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
  'apikey': CONFIG.SUPABASE_ANON_KEY,
});

// ============ DOM ELEMENTS ============
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const elements = {
  inputScreen: $('#input-screen'),
  cognitoInput: $('#cognito-input'),
  findRostersBtn: $('#find-rosters-btn'),
  errorMsg: $('#error-msg'),
  rosterList: $('#roster-list'),
  wrappedContainer: $('#wrapped-container'),
  closeBtn: $('#close-btn'),
  prevBtn: $('#prev-btn'),
  nextBtn: $('#next-btn'),
  navDots: $('#nav-dots'),
  restartBtn: $('#restart-btn'),
};

// ============ STATE ============
let state = {
  cognitoId: null,
  rosters: [],
  selectedRosterId: null,
  wrappedData: null,
  currentSlide: 0,
  totalSlides: 0,
};

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  initSlides();
});

function initEventListeners() {
  elements.findRostersBtn.addEventListener('click', handleFindRosters);
  elements.cognitoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleFindRosters();
  });
  elements.closeBtn.addEventListener('click', closeWrapped);
  elements.prevBtn.addEventListener('click', prevSlide);
  elements.nextBtn.addEventListener('click', nextSlide);
  elements.restartBtn.addEventListener('click', restart);
  
  // Share buttons
  $('#share-story-btn')?.addEventListener('click', () => shareAsImage('story'));
  $('#share-slides-btn')?.addEventListener('click', () => shareAsImage('slides'));
  
  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (!elements.wrappedContainer.classList.contains('active')) return;
    if (e.key === 'ArrowRight') nextSlide();
    if (e.key === 'ArrowLeft') prevSlide();
    if (e.key === 'Escape') closeWrapped();
  });

  // Swipe support
  let touchStartX = 0;
  elements.wrappedContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  });
  elements.wrappedContainer.addEventListener('touchend', (e) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? nextSlide() : prevSlide();
    }
  });
}

function initSlides() {
  const slides = $$('.slide');
  state.totalSlides = slides.length;
  
  // Create nav dots
  elements.navDots.innerHTML = '';
  for (let i = 0; i < state.totalSlides; i++) {
    const dot = document.createElement('button');
    dot.className = `nav-dot ${i === 0 ? 'active' : ''}`;
    dot.addEventListener('click', () => goToSlide(i));
    elements.navDots.appendChild(dot);
  }
}

// ============ API CALLS ============
async function handleFindRosters() {
  const cognitoId = elements.cognitoInput.value.trim();
  
  if (!cognitoId) {
    showError('Inserisci il tuo Cognito ID');
    return;
  }
  
  state.cognitoId = cognitoId;
  setLoading(elements.findRostersBtn, true);
  hideError();
  
  try {
    const response = await fetch(CONFIG.GET_ROSTERS_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ cognito_id: cognitoId }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Errore nel recupero delle rose');
    }
    
    state.rosters = data.rosters;
    renderRosterList();
    
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(elements.findRostersBtn, false);
  }
}

async function loadWrapped(rosterId) {
  state.selectedRosterId = rosterId;
  
  // Show loading on selected roster item
  const rosterItem = $(`[data-roster-id="${rosterId}"]`);
  if (rosterItem) rosterItem.classList.add('loading');
  
  try {
    const response = await fetch(CONFIG.GET_WRAPPED_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ roster_id: rosterId }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Errore nel caricamento del Wrapped');
    }
    
    state.wrappedData = data;
    populateWrapped();
    showWrapped();
    
  } catch (err) {
    showError(err.message);
  } finally {
    if (rosterItem) rosterItem.classList.remove('loading');
  }
}

// ============ RENDER FUNCTIONS ============
function renderRosterList() {
  if (state.rosters.length === 0) {
    elements.rosterList.style.display = 'none';
    showError('Nessuna rosa trovata');
    return;
  }
  
  elements.rosterList.style.display = 'block';
  elements.rosterList.innerHTML = state.rosters.map((roster) => `
    <li class="roster-item" data-roster-id="${roster.roster_id}" onclick="loadWrapped(${roster.roster_id})">
      <div class="info">
        <h3>Lega #${roster.league_id}</h3>
        <span>Creata: ${formatDate(roster.data_insert)}</span>
      </div>
      <div class="players">${roster.player_count} giocatori</div>
    </li>
  `).join('');
}

function populateWrapped() {
  const data = state.wrappedData;
  if (!data) return;
  
  // Debug
  console.log('Total rosters:', data.scout.total_rosters);
  console.log('Hidden gems:', data.scout.hidden_gems);
  
  // Slide 2: Performance Rosa (overperformance)
  const perf = data.performance;
  const overSign = parseFloat(perf.avg_overperf) >= 0 ? '+' : '';
  $('#stat-fvm').textContent = perf.verdict;
  $('#bar-fvm').style.setProperty('--fill', `${Math.min(100, Math.max(0, 50 + parseFloat(perf.avg_overperf) * 50))}%`);
  $('#percentile-fvm-text').textContent = `${perf.overperformers} giocatori sopra media, ${perf.underperformers} sotto`;
  
  // Slide 3: Gol + Assist
  animateNumber($('#stat-fm'), data.stats.total_goals + data.stats.total_assists);
  $('#bar-fm').style.setProperty('--fill', '50%');
  $('#percentile-fm-text').textContent = `${data.stats.total_goals} gol + ${data.stats.total_assists} assist`;
  
  // Slide 4: Top Performer
  if (data.highlights.top_performer) {
    $('#top-performer-name').textContent = data.highlights.top_performer.name;
    $('#top-performer-stats').textContent = `FM ${data.highlights.top_performer.fm} | ${data.highlights.top_performer.role} | ${data.highlights.top_performer.overperformance} vs media`;
  }
  
  // Slide 5: Bidone
  if (data.highlights.bidone) {
    $('#worst-roi-name').textContent = data.highlights.bidone.name;
    $('#worst-roi-stats').textContent = `FM ${data.highlights.bidone.fm} vs media ${data.highlights.bidone.role} di ${data.highlights.bidone.role_avg} (${data.highlights.bidone.underperformance})`;
  } else {
    $('#worst-roi-name').textContent = 'Nessun bidone!';
    $('#worst-roi-stats').textContent = 'Tutti sopra la media 💪';
  }
  
  // Slide 6: Bonus King (gol + assist)
  if (data.highlights.bonus_king) {
    $('#bonus-king-name').textContent = data.highlights.bonus_king.name;
    $('#bonus-king-stats').textContent = `${data.highlights.bonus_king.goals} gol + ${data.highlights.bonus_king.assists} assist`;
  } else {
    $('#bonus-king-name').textContent = 'Nessun bonus';
    $('#bonus-king-stats').textContent = '0 gol e 0 assist 😅';
  }
  
  // Slide 7: Malus King
  if (data.highlights.malus_king) {
    $('#malus-king-name').textContent = data.highlights.malus_king.name;
    const parts = [];
    if (data.highlights.malus_king.yellow > 0) parts.push(`${data.highlights.malus_king.yellow} 🟨`);
    if (data.highlights.malus_king.red > 0) parts.push(`${data.highlights.malus_king.red} 🟥`);
    if (data.highlights.malus_king.penalty_out > 0) parts.push(`${data.highlights.malus_king.penalty_out} rig.sbagliati`);
    $('#malus-king-stats').textContent = `${parts.join(' ')} = -${data.highlights.malus_king.total_malus} malus`;
  } else {
    $('#malus-king-name').textContent = 'Nessun malus!';
    $('#malus-king-stats').textContent = 'Rosa disciplinatissima';
  }
  $('#bar-malus').style.setProperty('--fill', `${Math.min(100, data.stats.total_malus * 5)}%`);
  $('#percentile-malus-text').textContent = `Totale: -${data.stats.total_malus.toFixed(1)} malus dalla rosa`;
  
  // Slide 8: Scout Rating
  animateNumber($('#scout-score'), Math.round(data.scout.score));
  const gemsList = $('#gems-list');
  if (data.scout.hidden_gems.length > 0) {
    gemsList.innerHTML = data.scout.hidden_gems.map((gem) => `
      <li>
        <div>
          <span class="gem-name">${gem.name}</span>
          <span class="gem-role">${gem.role}</span>
        </div>
        <div class="gem-stats">
          <span class="gem-fm">FM ${gem.fm}</span>
          <span class="gem-overperf">${gem.overperformance} vs media</span>
          <span class="gem-ownership">${gem.ownership_pct}% ownership</span>
        </div>
      </li>
    `).join('');
  } else {
    gemsList.innerHTML = '<li>Nessuna hidden gem - i tuoi giocatori sono mainstream!</li>';
  }
  
  // Slide 9: Portiere
  if (data.highlights.portiere) {
    const p = data.highlights.portiere;
    $('#top-scorer-name').textContent = p.name;
    
    const sign = parseFloat(p.fm_diff) >= 0 ? '+' : '';
    $('#top-scorer-stats').innerHTML = `
      ${p.verdict}<br>
      <small>FM ${p.fm} (${sign}${p.fm_diff} vs media ${p.fm_avg})</small>
    `;
  } else {
    $('#top-scorer-name').textContent = 'No portieri';
    $('#top-scorer-stats').textContent = 'Nessun portiere con min. 5 partite';
  }
  
  // Slide 10: Summary
  $('#summary-grid').innerHTML = `
    <div class="summary-item">
      <div class="value">${data.stats.player_count}</div>
      <div class="label">Giocatori</div>
    </div>
    <div class="summary-item">
      <div class="value">${data.stats.total_goals}</div>
      <div class="label">Gol</div>
    </div>
    <div class="summary-item">
      <div class="value">${data.stats.total_assists}</div>
      <div class="label">Assist</div>
    </div>
    <div class="summary-item">
      <div class="value">${data.stats.total_yellow + data.stats.total_red}</div>
      <div class="label">Cartellini</div>
    </div>
    <div class="summary-item">
      <div class="value">${parseFloat(data.performance.avg_overperf) >= 0 ? '+' : ''}${data.performance.avg_overperf}</div>
      <div class="label">Avg Overperf</div>
    </div>
    <div class="summary-item">
      <div class="value">${Math.round(data.scout.score)}</div>
      <div class="label">Scout Score</div>
    </div>
  `;
}

// ============ SLIDE NAVIGATION ============
function showWrapped() {
  elements.wrappedContainer.classList.add('active');
  document.body.style.overflow = 'hidden';
  goToSlide(0);
}

function closeWrapped() {
  elements.wrappedContainer.classList.remove('active');
  document.body.style.overflow = '';
}

function goToSlide(index) {
  if (index < 0 || index >= state.totalSlides) return;
  
  state.currentSlide = index;
  
  // Update slides
  $$('.slide').forEach((slide, i) => {
    slide.classList.toggle('active', i === index);
  });
  
  // Update dots
  $$('.nav-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
}

function nextSlide() {
  if (state.currentSlide < state.totalSlides - 1) {
    goToSlide(state.currentSlide + 1);
  }
}

function prevSlide() {
  if (state.currentSlide > 0) {
    goToSlide(state.currentSlide - 1);
  }
}

function restart() {
  closeWrapped();
  state.wrappedData = null;
  state.selectedRosterId = null;
}

// ============ UTILITY FUNCTIONS ============
function showError(msg) {
  elements.errorMsg.textContent = msg;
  elements.errorMsg.style.display = 'block';
}

function hideError() {
  elements.errorMsg.style.display = 'none';
}

function setLoading(btn, loading) {
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('it-IT', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
}

function animateNumber(el, target, decimals = 0) {
  const duration = 1000;
  const start = 0;
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * eased;
    
    el.textContent = decimals > 0 
      ? current.toFixed(decimals) 
      : Math.round(current);
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}

// Make loadWrapped available globally for onclick
window.loadWrapped = loadWrapped;

// ============ SHARE FUNCTIONS ============
function populateShareTemplate(type) {
  const data = state.wrappedData;
  if (!data) return;
  
  if (type === 'story') {
    // Story format (9:16)
    $('#share-verdict').textContent = data.performance.verdict;
    
    $('#share-stats').innerHTML = `
      <div class="share-stat-item">
        <div class="share-stat-value">${data.stats.total_goals}</div>
        <div class="share-stat-label">Gol</div>
      </div>
      <div class="share-stat-item">
        <div class="share-stat-value">${data.stats.total_assists}</div>
        <div class="share-stat-label">Assist</div>
      </div>
      <div class="share-stat-item">
        <div class="share-stat-value">${data.performance.overperformers}</div>
        <div class="share-stat-label">Sopra Media</div>
      </div>
      <div class="share-stat-item">
        <div class="share-stat-value">${Math.round(data.scout.score)}</div>
        <div class="share-stat-label">Scout Score</div>
      </div>
    `;
    
    const highlights = [];
    if (data.highlights.top_performer) {
      highlights.push({
        label: '🔥 Top Performer',
        value: data.highlights.top_performer.name
      });
    }
    if (data.highlights.bonus_king) {
      highlights.push({
        label: '⚽ Re dei Bonus',
        value: `${data.highlights.bonus_king.name} (${data.highlights.bonus_king.total})`
      });
    }
    if (data.highlights.portiere) {
      highlights.push({
        label: data.highlights.portiere.is_wall ? '🧱 Portiere' : '🥅 Portiere',
        value: data.highlights.portiere.name
      });
    }
    
    $('#share-highlights').innerHTML = highlights.map(h => `
      <div class="share-highlight-item">
        <span class="share-highlight-label">${h.label}</span>
        <span class="share-highlight-value">${h.value}</span>
      </div>
    `).join('');
    
  } else {
    // Square format (1:1)
    $('#share-verdict-sq').textContent = data.performance.verdict;
    
    $('#share-mini-stats').innerHTML = `
      <div class="share-mini-stat">
        <div class="value">${data.stats.total_goals}</div>
        <div class="label">Gol</div>
      </div>
      <div class="share-mini-stat">
        <div class="value">${data.stats.total_assists}</div>
        <div class="label">Assist</div>
      </div>
      <div class="share-mini-stat">
        <div class="value">${Math.round(data.scout.score)}</div>
        <div class="label">Scout</div>
      </div>
    `;
    
    if (data.highlights.top_performer) {
      $('#share-top-player').innerHTML = `
        <div class="label">🔥 TOP PERFORMER</div>
        <div class="name">${data.highlights.top_performer.name}</div>
      `;
    }
  }
}

async function shareAsImage(type) {
  const btn = type === 'story' ? $('#share-story-btn') : $('#share-slides-btn');
  const originalText = btn.textContent;
  btn.textContent = '⏳ Generando...';
  btn.disabled = true;
  
  try {
    // Populate template
    populateShareTemplate(type);
    
    // Select template
    const templateId = type === 'story' ? 'share-story-template' : 'share-square-template';
    const template = $(`#${templateId}`);
    const size = type === 'story' ? { w: 1080, h: 1920 } : { w: 1080, h: 1080 };
    
    // Move template into view temporarily for rendering
    template.style.left = '0';
    template.style.top = '0';
    template.style.zIndex = '-1';
    
    // Wait for fonts to load
    await document.fonts.ready;
    await new Promise(r => setTimeout(r, 100)); // Small delay for rendering
    
    // Capture as canvas
    const canvas = await html2canvas(template, {
      width: size.w,
      height: size.h,
      scale: 1,
      useCORS: true,
      backgroundColor: null,
    });
    
    // Hide template again
    template.style.left = '-9999px';
    
    // Convert to blob
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const fileName = type === 'story' ? 'fantacalcio-wrapped-story.png' : 'fantacalcio-wrapped-square.png';
    const file = new File([blob], fileName, { type: 'image/png' });
    
    // Try Web Share API (mobile)
    if (navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Il mio Fantacalcio Wrapped',
        text: 'Guarda come è andata la mia stagione! ⚽'
      });
    } else {
      // Fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
    
  } catch (err) {
    console.error('Share error:', err);
    alert('Errore nella generazione. Riprova!');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}
