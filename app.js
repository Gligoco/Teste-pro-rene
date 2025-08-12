/* global Fuse, QRCode */
(function () {
  const DATA_URL = './data.json';
  const FUSE_OPTIONS = {
    includeScore: true,
    threshold: 0.35,
    keys: [
      { name: 'marca', weight: 0.4 },
      { name: 'modelo', weight: 0.4 },
      { name: 'motor', weight: 0.3 },
      { name: 'aliases', weight: 0.6 },
    ],
  };

  const elements = {
    offlineBanner: document.getElementById('offlineBanner'),
    searchInput: document.getElementById('searchInput'),
    // voice removed
    clearBtn: document.getElementById('clearBtn'),
    recentList: document.getElementById('recentList'),
    recentSection: document.getElementById('recentSection'),
    results: document.getElementById('results'),
    resultsSection: document.getElementById('resultsSection'),
    emptyState: document.getElementById('emptyState'),
    noResults: document.getElementById('noResults'),
    toast: document.getElementById('toast'),
    toastMsg: document.getElementById('toastMsg'),
    toastReload: document.getElementById('toastReload'),
  };

  let allData = [];
  let fuse = null;
  let fuseData = [];


  function normalizeString(value) {
    return (value || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Map common spoken forms to numeric engine sizes (pt-BR)
  function normalizeNumbersPtBR(text) {
    const repl = [
      ['um ponto zero', '1.0'],
      ['um ponto dois', '1.2'],
      ['um ponto tres', '1.3'],
      ['um ponto quatro', '1.4'],
      ['um ponto cinco', '1.5'],
      ['um ponto seis', '1.6'],
      ['um ponto oito', '1.8'],
      ['dois ponto zero', '2.0'],
      ['dois ponto dois', '2.2'],
      ['tres ponto zero', '3.0'],
    ];
    let t = text;
    for (const [a, b] of repl) {
      t = t.replace(new RegExp(a, 'g'), b);
    }
    return t;
  }

  function prepareFuseData(data) {
    // Create normalized clone for searching only
    return data.map((item) => ({
      ref: item,
      marca: normalizeString(item.marca),
      modelo: normalizeString(item.modelo),
      motor: normalizeString(item.motor),
      aliases: (item.aliases || []).map((a) => normalizeString(a)),
    }));
  }

  function showOfflineBannerIfNeeded() {
    if (navigator.onLine === false) {
      elements.offlineBanner.hidden = false;
    } else {
      elements.offlineBanner.hidden = true;
    }
  }

  window.addEventListener('online', showOfflineBannerIfNeeded);
  window.addEventListener('offline', showOfflineBannerIfNeeded);

  function loadData() {
    return fetch(DATA_URL, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((json) => {
        allData = json;
        fuseData = prepareFuseData(allData);
        fuse = new Fuse(fuseData, FUSE_OPTIONS);
        renderRecent();
        handleHashRoute();
      })
      .catch((err) => {
        console.warn('Falha ao carregar data.json', err);
        showToast('Falha ao carregar dados. Tente novamente ou use offline.');
      });
  }

  function saveRecentId(id) {
    if (!id) return;
    const key = 'recentIds.v1';
    const ids = JSON.parse(localStorage.getItem(key) || '[]');
    const filtered = [id, ...ids.filter((x) => x !== id)].slice(0, 5);
    localStorage.setItem(key, JSON.stringify(filtered));
  }

  function getRecentIds() {
    try {
      return JSON.parse(localStorage.getItem('recentIds.v1') || '[]');
    } catch (_) {
      return [];
    }
  }

  function renderRecent() {
    const ids = getRecentIds();
    elements.recentList.innerHTML = '';
    if (!ids.length) {
      elements.recentSection.hidden = false;
      return;
    }
    ids.forEach((id) => {
      const item = allData.find((x) => x.id === id);
      if (!item) return;
      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.textContent = `${item.marca} ${item.modelo} ${item.motor}`;
      btn.setAttribute('role', 'listitem');
      btn.onclick = () => {
        elements.searchInput.value = `${item.marca} ${item.modelo} ${item.motor}`;
        doSearch();
      };
      elements.recentList.appendChild(btn);
    });
  }

  function sortResults(query, fuseResults) {
    const q = normalizeString(query);
    const scoreById = new Map();

    fuseResults.forEach((res, idx) => {
      const item = res.item.ref || res.item;
      scoreById.set(item.id, res.score ?? 1 + idx * 0.001);
    });

    fuseResults.forEach((res) => {
      const item = res.item.ref || res.item;
      const concat = normalizeString(`${item.marca} ${item.modelo} ${item.motor} ${(item.aliases||[]).join(' ')}`);
      if (q && concat.includes(q)) {
        scoreById.set(item.id, (scoreById.get(item.id) || 1) * 0.5);
      }
    });

    const recent = getRecentIds();
    fuseResults.forEach((res) => {
      const item = res.item.ref || res.item;
      if (recent.includes(item.id)) {
        scoreById.set(item.id, (scoreById.get(item.id) || 1) * 0.7);
      }
    });

    return [...fuseResults]
      .sort((a, b) => {
        const ai = (a.item.ref || a.item).id;
        const bi = (b.item.ref || b.item).id;
        return (scoreById.get(ai) || 1) - (scoreById.get(bi) || 1);
      })
      .map((r) => r.item.ref || r.item);
  }

  function renderResults(items, highlightId) {
    elements.results.innerHTML = '';
    elements.noResults.hidden = items.length !== 0;
    elements.emptyState.hidden = elements.searchInput.value.trim().length > 0 || items.length > 0;

    items.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.setAttribute('role', 'listitem');
      if (highlightId && item.id === highlightId) card.classList.add('highlight');

      const title = `${item.marca} ${item.modelo}`;
      const version = `${item.motor} ${item.anos || ''}`.trim();

      card.innerHTML = `
        <div class="card-header">
          <div>
            <h3 class="card-title">${title}</h3>
            <div class="card-meta">${version}</div>
          </div>
          <span class="badge">${item.id}</span>
        </div>

        ${renderOilSections(item)}

        ${renderNotes(item)}

        <div class="actions">
          <button class="btn" data-copy="${location.origin + location.pathname}#/${item.id}">Copiar link</button>
          <button class="btn secondary" data-qr="${location.origin + location.pathname}#/${item.id}">QR</button>
        </div>
        <div class="qr-wrap" hidden></div>
      `;

      card.querySelector('button[data-copy]')?.addEventListener('click', async (e) => {
        const url = e.currentTarget.getAttribute('data-copy');
        try {
          await navigator.clipboard.writeText(url);
          showToast('Link copiado');
        } catch (_) {
          showToast('Não foi possível copiar o link');
        }
      });

      card.querySelector('button[data-qr]')?.addEventListener('click', (e) => {
        const url = e.currentTarget.getAttribute('data-qr');
        const wrap = card.querySelector('.qr-wrap');
        if (!wrap) return;
        if (!wrap.hasChildNodes()) {
          const c = document.createElement('div');
          c.className = 'qr';
          wrap.appendChild(c);
          if (window.QRCode) {
            QRCode.toCanvas(c, url, { width: 160 }, (err) => {
              if (err) console.error(err);
            });
          }
        }
        wrap.hidden = !wrap.hidden;
      });

      elements.results.appendChild(card);
    });
  }

  function renderOilSections(item) {
    const motor = item.oleo_motor;
    const cambio = item.oleo_cambio;
    const dif = item.diferencial;

    const motorHtml = motor ? `
      <div class="section">
        <div class="section-title">Motor</div>
        <div class="kv">
          <div class="k">Viscosidade</div><div class="v">${motor.viscosidade || '-'}</div>
          ${motor.especificacao ? `<div class="k">Especificação</div><div class="v">${(motor.especificacao||[]).join(', ')}</div>` : ''}
          ${typeof motor.capacidade_sem_filtro_l === 'number' ? `<div class="k">Capacidade s/ filtro</div><div class="v">${motor.capacidade_sem_filtro_l.toFixed(1)} L</div>` : ''}
          ${typeof motor.capacidade_com_filtro_l === 'number' ? `<div class="k">Capacidade c/ filtro</div><div class="v">${motor.capacidade_com_filtro_l.toFixed(1)} L</div>` : ''}
          ${motor.obs ? `<div class="k">Obs.</div><div class="v">${motor.obs}</div>` : ''}
        </div>
      </div>` : '';

    const cambioHtml = cambio ? `
      <div class="section">
        <div class="section-title">Câmbio</div>
        <div class="kv">
          ${cambio.tipo ? `<div class="k">Tipo</div><div class="v">${cambio.tipo}</div>` : ''}
          ${typeof cambio.capacidade_l === 'number' ? `<div class="k">Capacidade</div><div class="v">${cambio.capacidade_l.toFixed(1)} L</div>` : ''}
          ${cambio.obs ? `<div class="k">Obs.</div><div class="v">${cambio.obs}</div>` : ''}
        </div>
      </div>` : '';

    const difHtml = dif ? `
      <div class="section">
        <div class="section-title">Diferencial</div>
        <div class="kv">
          ${dif.tipo ? `<div class="k">Tipo</div><div class="v">${dif.tipo}</div>` : ''}
          ${typeof dif.capacidade_l === 'number' ? `<div class="k">Capacidade</div><div class="v">${dif.capacidade_l.toFixed(1)} L</div>` : ''}
          ${dif.obs ? `<div class="k">Obs.</div><div class="v">${dif.obs}</div>` : ''}
        </div>
      </div>` : '';

    return motorHtml + cambioHtml + difHtml;
  }

  function renderNotes(item) {
    if (!item.notas || !item.notas.length) return '';
    return `
      <div class="section">
        <div class="section-title">Observações</div>
        <ul>${item.notas.map((n) => `<li>${n}</li>`).join('')}</ul>
      </div>
    `;
  }

  function doSearch() {
    const qRaw = elements.searchInput.value;
    const normalized = normalizeString(normalizeNumbersPtBR(normalizeString(qRaw)));
    const minLen = 1;
    if (!fuse || normalized.length < minLen) {
      renderResults([]);
      return;
    }
    const results = fuse.search(normalized);
    const items = sortResults(normalized, results);
    renderResults(items);
    if (items.length > 0) {
      const first = items[0];
      saveRecentId(first.id);
      renderRecent();
      history.replaceState(null, '', `#/${first.id}`);
    }
  }

  function handleHashRoute() {
    const hash = location.hash || '';
    const match = hash.match(/^#\/(.+)$/);
    if (!match) return;
    const id = match[1];
    if (!allData || !allData.length) return;
    const item = allData.find((x) => x.id === id);
    if (!item) return;
    saveRecentId(item.id);
    renderRecent();
    renderResults([item], item.id);
    elements.searchInput.value = `${item.marca} ${item.modelo} ${item.motor}`;
  }

  function setupSearchInput() {
    let debounceTimer = null;
    elements.searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doSearch, 120);
    });
    elements.clearBtn.addEventListener('click', () => {
      elements.searchInput.value = '';
      history.replaceState(null, '', '#');
      renderResults([]);
    });
  }

  function setupVoice() {
    // Voice feature removed
  }

  function showToast(message, withReload = false) {
    elements.toastMsg.textContent = message;
    elements.toast.hidden = false;
    elements.toastReload.hidden = !withReload;
  }

  function hideToast() {
    elements.toast.hidden = true;
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        if (reg.waiting) {
          showToast('App atualizado — recarregue', true);
        }
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showToast('App atualizado — recarregue', true);
            }
          });
        });
      });

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data === 'SW_UPDATED') {
          showToast('App atualizado — recarregue', true);
        }
      });
    });

    elements.toastReload.addEventListener('click', () => {
      hideToast();
      location.reload();
    });
  }

  window.addEventListener('hashchange', handleHashRoute);

  showOfflineBannerIfNeeded();
  setupSearchInput();
  setupVoice();
  registerServiceWorker();
  loadData();
})();