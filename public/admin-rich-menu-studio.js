(() => {
  const root = document.getElementById('sms-app');
  const loading = document.getElementById('sms-loading');
  const tabs = [...document.querySelectorAll('.sms-tabs [data-view]')];
  const state = { view: 'projects', projects: [], templates: [], studio: null, definition: null, activeArea: 0, dirty: false, template: null };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const fmt = value => value ? new Date(value).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

  async function api(url, options = {}) {
    const response = await fetch(url, options);
    if (response.status === 401) { location.href = '/admin/login'; throw new Error('登入已逾時'); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || '操作失敗');
    return data;
  }

  function toast(message, error = false) {
    document.querySelector('.sms-toast')?.remove();
    const item = document.createElement('div');
    item.className = `sms-toast${error ? ' error' : ''}`;
    item.textContent = message;
    document.body.appendChild(item);
    setTimeout(() => item.remove(), 4200);
  }

  function setBusy(busy, message = '載入中…') {
    loading.hidden = !busy;
    loading.lastChild.textContent = message;
    root.hidden = busy;
  }

  function setTab(view) {
    tabs.forEach(button => button.classList.toggle('active', button.dataset.view === view));
  }

  function statusView(project) {
    if (project.is_default) return ['預設首頁', 'default'];
    if (project.status === 'published') return ['已發布', 'published'];
    if (project.status === 'archived') return ['已停用', 'archived'];
    if (project.status === 'publishing') return ['發布中', 'published'];
    if (project.status === 'failed') return ['發布失敗', 'archived'];
    return ['草稿', ''];
  }

  async function navigate(view, id = '') {
    state.view = view;
    setTab(view.startsWith('template') ? 'templates' : 'projects');
    setBusy(true, view === 'project-editor' ? '載入專案內容…' : '載入工作區…');
    try {
      if (view === 'projects') await renderProjects();
      else if (view === 'templates') await renderTemplates();
      else if (view === 'project-builder') await renderProjectBuilder(id);
      else if (view === 'project-editor') await renderProjectEditor(id);
      else if (view === 'template-editor') await renderTemplateEditor(id);
      root.hidden = false;
      loading.hidden = true;
      history.replaceState(null, '', `/admin/rich-menu?view=${encodeURIComponent(view)}${id ? `&id=${encodeURIComponent(id)}` : ''}`);
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (error) {
      loading.hidden = true;
      root.hidden = false;
      root.innerHTML = `<div class="sms-empty"><strong>工作區載入失敗</strong>${esc(error.message)}<div style="margin-top:14px"><button class="sms-btn" id="sms-retry">重新整理</button></div></div>`;
      document.getElementById('sms-retry').onclick = () => navigate(view, id);
    }
  }

  async function loadCatalog() {
    const [projectsData, templatesData] = await Promise.all([
      api('/api/admin/rich-menu/projects'),
      api('/api/admin/rich-menu/templates'),
    ]);
    state.projects = projectsData.projects || [];
    state.templates = templatesData.templates || [];
  }

  async function renderProjects() {
    await loadCatalog();
    const enabled = state.projects.filter(project => project.status !== 'archived').length;
    root.innerHTML = `<div class="sms-page-head"><div><h2>圖文選單專案</h2><p>每個 Project 代表一個選單頁；發布會同時將該頁設為目前使用中的 LINE 選單。</p></div><button class="sms-btn primary" id="sms-new-project">＋ 新增專案</button></div>
      <div class="sms-callout">ⓘ <span>發布會建立 Rich Menu、上傳圖片、更新 Alias，並將該頁切換為目前使用中的 LINE 選單。</span></div>
      ${enabled < 2 ? '<div class="sms-callout warn">⚠ <span>切換頁至少需要 2 個啟用中的 Project。請先建立第二個專案，再設定彼此的「切換頁」Action。</span></div>' : ''}
      <div class="sms-toolbar"><input id="sms-project-search" placeholder="搜尋專案名稱"><button class="sms-btn" id="sms-refresh-projects">重新整理</button><span class="sms-count">${state.projects.length} 個專案</span></div>
      <div class="sms-list" id="sms-project-list"></div>`;
    const draw = () => {
      const needle = document.getElementById('sms-project-search').value.trim().toLowerCase();
      const rows = state.projects.filter(project => !needle || project.name.toLowerCase().includes(needle) || project.template_name.toLowerCase().includes(needle));
      document.getElementById('sms-project-list').innerHTML = rows.length ? rows.map(project => {
        const [label, klass] = statusView(project);
        const published = Boolean(project.line_rich_menu_id);
        return `<div class="sms-row"><div class="sms-row-main" data-edit-project="${esc(project.id)}"><img class="sms-thumb" src="${esc(project.image_url)}" alt=""><div class="sms-row-copy"><b>${esc(project.name)}</b><small>${esc(project.template_name)} · ${project.area_count || 0} 個熱區 · 1 頁</small><small>更新於 ${esc(fmt(project.updated_at))}</small></div></div><div class="sms-row-actions"><span class="sms-status ${klass}">${label}</span><button class="sms-btn" data-edit-project="${esc(project.id)}">編輯</button><button class="sms-btn publish" data-publish-project="${esc(project.id)}">${published ? '重新發布' : '發布'}</button>${published && !project.is_default ? `<button class="sms-btn" data-default-project="${esc(project.id)}">設為預設</button>` : ''}<button class="sms-btn ${project.status === 'archived' ? '' : 'danger'}" data-toggle-project="${esc(project.id)}">${project.status === 'archived' ? '啟用' : '停用'}</button></div></div>`;
      }).join('') : '<div class="sms-empty"><strong>沒有符合的專案</strong>可從模板建立第一個圖文選單專案。</div>';
      bindProjectRows();
    };
    document.getElementById('sms-new-project').onclick = () => navigate('project-builder');
    document.getElementById('sms-refresh-projects').onclick = () => navigate('projects');
    document.getElementById('sms-project-search').oninput = draw;
    draw();
  }

  function bindProjectRows() {
    document.querySelectorAll('[data-edit-project]').forEach(button => button.onclick = () => navigate('project-editor', button.dataset.editProject));
    document.querySelectorAll('[data-publish-project]').forEach(button => button.onclick = () => openPublishDialog(button.dataset.publishProject));
    document.querySelectorAll('[data-default-project]').forEach(button => button.onclick = async () => {
      button.disabled = true;
      try { await api(`/api/admin/rich-menu/projects/${encodeURIComponent(button.dataset.defaultProject)}/set-default`, { method: 'POST' }); toast('已設為 LINE 預設首頁。'); await renderProjects(); }
      catch (error) { toast(error.message, true); button.disabled = false; }
    });
    document.querySelectorAll('[data-toggle-project]').forEach(button => button.onclick = async () => {
      const project = state.projects.find(item => item.id === button.dataset.toggleProject);
      if (project?.status !== 'archived' && !confirm(`確定停用「${project?.name || '此專案'}」？系統會解除該頁面的 LINE Alias。`)) return;
      button.disabled = true;
      try { await api(`/api/admin/rich-menu/projects/${encodeURIComponent(button.dataset.toggleProject)}/toggle`, { method: 'POST' }); toast(project?.status === 'archived' ? '專案已啟用，請重新發布以建立 Alias。' : '專案已停用並解除 Alias。'); await renderProjects(); }
      catch (error) { toast(error.message, true); button.disabled = false; }
    });
  }

  async function renderTemplates() {
    await loadCatalog();
    const active = state.templates.filter(template => template.status === 'active');
    root.innerHTML = `<div class="sms-page-head"><div><h2>模板中心</h2><p>集中管理圖文選單母版；專案建立後會保留獨立快照，不受母版後續修改影響。</p></div><button class="sms-btn primary" id="sms-new-template">＋ 建立模板</button></div><div class="sms-callout">ⓘ <span>模板保存圖片尺寸、熱區座標、區域名稱與預設 Action。建立專案後，再填入客戶實際內容。</span></div><div class="sms-template-grid">${active.length ? active.map(template => `<article class="sms-template"><img src="${esc(template.image_url)}" alt=""><div class="sms-template-body"><h3>${esc(template.name)}</h3><p>${esc(template.description || '尚未填寫模板說明')}</p><div class="sms-template-meta"><span>${template.area_count || 0} 個熱區 · 1 頁</span><span>${template.verification_status === 'draft' ? '草稿' : '已驗證'} · v${template.revision || 1}</span></div><div class="sms-template-actions"><button class="sms-btn" data-edit-template="${esc(template.id)}">編輯</button><button class="sms-btn primary" data-use-template="${esc(template.id)}">建立專案</button><button class="sms-btn danger" data-archive-template="${esc(template.id)}">封存</button></div></div></article>`).join('') : '<div class="sms-empty"><strong>尚無可用模板</strong>請先建立模板。</div>'}</div>`;
    document.getElementById('sms-new-template').onclick = () => navigate('template-editor');
    document.querySelectorAll('[data-edit-template]').forEach(button => button.onclick = () => navigate('template-editor', button.dataset.editTemplate));
    document.querySelectorAll('[data-use-template]').forEach(button => button.onclick = () => navigate('project-builder', button.dataset.useTemplate));
    document.querySelectorAll('[data-archive-template]').forEach(button => button.onclick = async () => { if (!confirm('確定封存此模板？已建立的專案不會受到影響。')) return; try { await api(`/api/admin/rich-menu/templates/${encodeURIComponent(button.dataset.archiveTemplate)}`, { method: 'DELETE' }); toast('模板已封存。'); await renderTemplates(); } catch (error) { toast(error.message, true); } });
  }

  async function renderProjectBuilder(preselected = '') {
    await loadCatalog();
    const templates = state.templates.filter(template => template.status === 'active');
    state.selectedTemplate = preselected || templates[0]?.id || '';
    root.innerHTML = `<div class="sms-builder"><button class="sms-back" id="sms-builder-back">← 返回專案</button><div class="sms-page-head"><div><h2>新增圖文選單專案</h2><p>先選一套模板，再建立可獨立編輯與發布的專案。</p></div></div><div class="sms-choice-grid" id="sms-template-choices">${templates.map(template => `<button class="sms-choice ${template.id === state.selectedTemplate ? 'active' : ''}" data-template-choice="${esc(template.id)}"><img src="${esc(template.image_url)}" alt=""><div><b>${esc(template.name)}</b><small>${template.area_count || 0} 個熱區 · 1 頁</small></div></button>`).join('')}</div><div class="sms-form-card"><label>專案名稱<input id="sms-project-name" maxlength="120" value="${esc((templates.find(item => item.id === state.selectedTemplate)?.name || '新圖文選單') + ' - 新專案')}"></label><div class="sms-callout" style="margin-top:14px;margin-bottom:0">ⓘ <span id="sms-template-note">來源模板：${esc(templates.find(item => item.id === state.selectedTemplate)?.name || '—')}。建立後會複製座標與 Action 結構，日後母版修改不會影響此專案。</span></div><footer><button class="sms-btn" id="sms-builder-cancel">取消</button><button class="sms-btn primary" id="sms-create-project">建立並開始設定</button></footer></div></div>`;
    document.getElementById('sms-builder-back').onclick = document.getElementById('sms-builder-cancel').onclick = () => navigate('projects');
    document.querySelectorAll('[data-template-choice]').forEach(button => button.onclick = () => {
      state.selectedTemplate = button.dataset.templateChoice;
      document.querySelectorAll('[data-template-choice]').forEach(item => item.classList.toggle('active', item === button));
      const template = templates.find(item => item.id === state.selectedTemplate);
      document.getElementById('sms-template-note').textContent = `來源模板：${template.name}。建立後會複製座標與 Action 結構，日後母版修改不會影響此專案。`;
    });
    document.getElementById('sms-create-project').onclick = async event => {
      const name = document.getElementById('sms-project-name').value.trim();
      if (!state.selectedTemplate || !name) return toast('請選擇模板並輸入專案名稱。', true);
      event.currentTarget.disabled = true;
      try { const data = await api('/api/admin/rich-menu/projects/from-template', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ templateId: state.selectedTemplate, name }) }); toast('專案已建立。'); await navigate('project-editor', data.project.id); }
      catch (error) { toast(error.message, true); event.currentTarget.disabled = false; }
    };
  }

  function areaLabel(area, index) { return area?.action?.label || `區塊 ${index + 1}`; }
  function actionBadge(action) { return ({ uri: '開啟網址', message: '傳送文字', postback: 'Postback', richmenuswitch: '切換頁' })[action?.type] || '未設定'; }

  async function renderProjectEditor(projectId) {
    const data = await api(`/api/admin/rich-menu/studio?projectId=${encodeURIComponent(projectId)}`);
    state.studio = data;
    state.definition = structuredClone(data.project.definition);
    state.activeArea = 0;
    state.dirty = false;
    const project = data.project;
    const [label, klass] = statusView(project);
    root.innerHTML = `<div class="sms-editor"><header class="sms-editor-head"><div class="sms-editor-title"><button class="sms-btn" id="sms-editor-back" aria-label="返回">←</button><div><input id="sms-editor-name" maxlength="120" value="${esc(project.name)}"><small>專案內容設定 · 已從模板建立獨立快照</small></div></div><div class="sms-editor-tools"><input id="sms-project-image-input" type="file" accept="image/png,image/jpeg" hidden><button class="sms-btn" id="sms-project-image">▧ 更換專案圖片</button><button class="sms-btn primary" id="sms-save-project">儲存專案</button><button class="sms-btn publish" id="sms-publish-project">➤ 發布圖文選單</button><button class="sms-btn" id="sms-verify-project">驗證</button><span class="sms-status ${klass}" id="sms-editor-status">${label}</span></div></header><div class="sms-editor-grid"><section class="sms-editor-left"><div class="sms-intro"><h3>請完成客戶內容</h3><p>模板提供圖片、座標、區域名稱與預設 Action；此專案可獨立調整每個區域的最終動作，不會回寫模板。</p></div><div class="sms-meta"><label>LINE 選單名稱<input id="sms-menu-name" maxlength="300" value="${esc(state.definition.name)}"></label><label>聊天列文字<input id="sms-chatbar" maxlength="14" value="${esc(state.definition.chatBarText)}"></label><label class="sms-check"><input id="sms-selected" type="checkbox" ${state.definition.selected ? 'checked' : ''}> 預設展開選單</label></div><div class="sms-area-tabs" id="sms-area-tabs"></div><div class="sms-action-card"><h4 id="sms-action-title"></h4><small id="sms-action-help"></small><div class="sms-action-form" id="sms-action-form"></div></div><details class="sms-history"><summary>版本與上架紀錄</summary><div class="sms-history-grid" id="sms-history-grid"></div></details></section><aside class="sms-editor-right"><div class="sms-phone"><div class="sms-phone-head">LINE 預覽</div><div class="sms-canvas" id="sms-canvas"><img id="sms-canvas-image" src="${esc(project.image_url)}" alt="${esc(project.name)}"><div id="sms-hotspots"></div></div><div class="sms-phone-foot">${esc(state.definition.chatBarText)}</div></div></aside></div></div>`;
    bindEditorShell(projectId);
    renderAreaEditor(projectId);
    renderHistory();
  }

  function bindEditorShell(projectId) {
    const markDirty = () => { state.dirty = true; document.getElementById('sms-editor-status').textContent = '尚未儲存'; };
    document.getElementById('sms-editor-back').onclick = () => state.dirty && !confirm('尚有未儲存變更，確定離開？') ? null : navigate('projects');
    ['sms-editor-name', 'sms-menu-name', 'sms-chatbar', 'sms-selected'].forEach(id => document.getElementById(id).addEventListener('input', markDirty));
    document.getElementById('sms-chatbar').addEventListener('input', event => document.querySelector('.sms-phone-foot').textContent = event.target.value || '選單');
    document.getElementById('sms-save-project').onclick = () => saveProject(projectId, true);
    document.getElementById('sms-publish-project').onclick = () => openPublishDialog(projectId, true);
    document.getElementById('sms-verify-project').onclick = async event => {
      event.currentTarget.disabled = true;
      try { const result = await api(`/api/admin/rich-menu/verify?projectId=${encodeURIComponent(projectId)}`); toast(result.ok ? '線上版本、圖片與預設選單均驗證通過。' : `驗證未完全通過：預設 ${result.defaultMatch ? '一致' : '不一致'}、內容 ${result.definitionMatch ? '一致' : '不一致'}、圖片 ${result.imageShaMatch ? '一致' : '不一致'}`, !result.ok); }
      catch (error) { toast(error.message, true); }
      finally { event.currentTarget.disabled = false; }
    };
    document.getElementById('sms-project-image').onclick = () => document.getElementById('sms-project-image-input').click();
    document.getElementById('sms-project-image-input').onchange = async event => {
      const file = event.target.files[0];
      if (!file) return;
      const form = new FormData(); form.append('image', file);
      const button = document.getElementById('sms-project-image'); button.disabled = true; button.textContent = '上傳中…';
      try { const result = await api(`/api/admin/rich-menu/projects/${encodeURIComponent(projectId)}/upload-image`, { method: 'POST', body: form }); document.getElementById('sms-canvas-image').src = `${result.asset.imagePath}?v=${Date.now()}`; toast('專案圖片已更換並建立新草稿版本。'); state.dirty = false; }
      catch (error) { toast(error.message, true); }
      finally { button.disabled = false; button.textContent = '▧ 更換專案圖片'; event.target.value = ''; }
    };
  }

  function syncDefinitionMeta() {
    state.studio.project.name = document.getElementById('sms-editor-name').value.trim();
    state.definition.name = document.getElementById('sms-menu-name').value.trim();
    state.definition.chatBarText = document.getElementById('sms-chatbar').value.trim();
    state.definition.selected = document.getElementById('sms-selected').checked;
  }

  async function saveProject(projectId, notify = false) {
    syncDefinitionMeta();
    const button = document.getElementById('sms-save-project'); button.disabled = true; button.textContent = '儲存中…';
    try {
      const result = await api(`/api/admin/rich-menu/projects/${encodeURIComponent(projectId)}/draft`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectName: state.studio.project.name, definition: state.definition }) });
      state.dirty = false; state.studio.project.revision = result.revision;
      document.getElementById('sms-editor-status').className = 'sms-status'; document.getElementById('sms-editor-status').textContent = `草稿 v${result.revision}`;
      if (notify) toast('圖文選單專案已儲存。');
      return result;
    } finally { button.disabled = false; button.textContent = '儲存專案'; }
  }

  function renderAreaEditor(projectId) {
    const definition = state.definition;
    const area = definition.areas[state.activeArea];
    const width = definition.size.width, height = definition.size.height;
    const canvas = document.getElementById('sms-canvas');
    canvas.style.aspectRatio = `${width}/${height}`;
    document.getElementById('sms-area-tabs').innerHTML = definition.areas.map((item, index) => `<button class="sms-area-tab ${index === state.activeArea ? 'active' : ''}" data-area-index="${index}">${esc(areaLabel(item, index))}</button>`).join('');
    document.getElementById('sms-hotspots').innerHTML = definition.areas.map((item, index) => `<button class="sms-hotspot ${index === state.activeArea ? 'active' : ''}" data-area-index="${index}" style="left:${item.bounds.x / width * 100}%;top:${item.bounds.y / height * 100}%;width:${item.bounds.width / width * 100}%;height:${item.bounds.height / height * 100}%"><span>${esc(areaLabel(item, index))} · ${esc(actionBadge(item.action))}</span></button>`).join('');
    document.querySelectorAll('[data-area-index]').forEach(button => button.onclick = () => { state.activeArea = Number(button.dataset.areaIndex); renderAreaEditor(projectId); });
    document.getElementById('sms-action-title').textContent = `設定【${areaLabel(area, state.activeArea)}】`;
    document.getElementById('sms-action-help').textContent = ({ uri: '開啟客戶指定網址', message: '點擊後傳送指定文字', postback: '送出流程 Data，可選擇是否顯示文字', richmenuswitch: '切換到同一個工作區的另一個 Project 頁面' })[area.action.type] || '設定此區域動作';
    const targets = state.studio.switchTargets || [];
    let fields = '';
    if (area.action.type === 'uri') fields = `<label>網址<input id="sms-action-uri" value="${esc(area.action.uri || '')}" placeholder="https://..."><small>只修改此專案，不會影響模板母版。</small></label>`;
    else if (area.action.type === 'message') fields = `<label>傳送文字<textarea id="sms-action-text" rows="3" placeholder="例如：我要預約">${esc(area.action.text || '')}</textarea></label>`;
    else if (area.action.type === 'postback') fields = `<label>Data<input id="sms-action-data" value="${esc(area.action.data || '')}" placeholder="action=security_info"></label><label>顯示文字（選填）<input id="sms-action-display" value="${esc(area.action.displayText || '')}"></label>`;
    else fields = `<label>目標頁面<select id="sms-switch-target"><option value="">請選擇目標頁面</option>${targets.map(target => `<option value="${esc(target.id)}" ${target.id === area.action.targetProjectId ? 'selected' : ''}>${esc(target.name)}</option>`).join('')}</select></label>${targets.length ? '<div class="sms-callout" style="margin:0">系統會自動填入目標 Alias 與 switch data。</div>' : '<div class="sms-callout warn" style="margin:0">切換頁至少需要另一個啟用中的 Project。</div>'}`;
    document.getElementById('sms-action-form').innerHTML = `<label>區塊名稱<input id="sms-area-label" maxlength="20" value="${esc(areaLabel(area, state.activeArea))}"></label><label>動作類型<select id="sms-action-type"><option value="uri">開啟網址</option><option value="message">傳送文字</option><option value="postback">Postback</option><option value="richmenuswitch">切換頁</option></select></label>${fields}<div><b style="font-size:12px">熱區座標</b><div class="sms-coordinates"><label>X<input id="sms-bound-x" type="number" min="0" value="${area.bounds.x}"></label><label>Y<input id="sms-bound-y" type="number" min="0" value="${area.bounds.y}"></label><label>寬<input id="sms-bound-width" type="number" min="1" value="${area.bounds.width}"></label><label>高<input id="sms-bound-height" type="number" min="1" value="${area.bounds.height}"></label></div></div><div class="sms-help">座標不可超出 ${width} × ${height}，熱區彼此不可重疊；儲存時會再驗證。</div>`;
    document.getElementById('sms-action-type').value = area.action.type;
    const dirtyRender = () => { state.dirty = true; const status = document.getElementById('sms-editor-status'); if (status) status.textContent = '尚未儲存'; };
    document.getElementById('sms-area-label').oninput = event => { area.action.label = event.target.value; dirtyRender(); const selectors = document.querySelectorAll(`[data-area-index="${state.activeArea}"]`); selectors.forEach(item => { const label = item.querySelector('span'); if (label) label.textContent = `${areaLabel(area, state.activeArea)} · ${actionBadge(area.action)}`; else item.textContent = areaLabel(area, state.activeArea); }); document.getElementById('sms-action-title').textContent = `設定【${areaLabel(area, state.activeArea)}】`; };
    document.getElementById('sms-action-type').onchange = event => {
      const label = area.action.label || areaLabel(area, state.activeArea);
      area.action = event.target.value === 'uri' ? { type: 'uri', label, uri: 'https://' } : event.target.value === 'message' ? { type: 'message', label, text: label } : event.target.value === 'postback' ? { type: 'postback', label, data: `action=custom_${state.activeArea + 1}`, displayText: label } : { type: 'richmenuswitch', label, targetProjectId: '', richMenuAliasId: '', data: '' };
      dirtyRender(); renderAreaEditor(projectId);
    };
    [['sms-bound-x', 'x'], ['sms-bound-y', 'y'], ['sms-bound-width', 'width'], ['sms-bound-height', 'height']].forEach(([id, key]) => document.getElementById(id).oninput = event => { area.bounds[key] = Number(event.target.value); dirtyRender(); const hotspot = document.querySelector(`.sms-hotspot[data-area-index="${state.activeArea}"]`); if (hotspot) { hotspot.style.left = `${area.bounds.x / width * 100}%`; hotspot.style.top = `${area.bounds.y / height * 100}%`; hotspot.style.width = `${area.bounds.width / width * 100}%`; hotspot.style.height = `${area.bounds.height / height * 100}%`; } });
    document.getElementById('sms-action-uri')?.addEventListener('input', event => { area.action.uri = event.target.value; dirtyRender(); });
    document.getElementById('sms-action-text')?.addEventListener('input', event => { area.action.text = event.target.value; dirtyRender(); });
    document.getElementById('sms-action-data')?.addEventListener('input', event => { area.action.data = event.target.value; dirtyRender(); });
    document.getElementById('sms-action-display')?.addEventListener('input', event => { area.action.displayText = event.target.value; dirtyRender(); });
    document.getElementById('sms-switch-target')?.addEventListener('change', event => { const target = targets.find(item => item.id === event.target.value); area.action.targetProjectId = target?.id || ''; area.action.richMenuAliasId = target?.alias_id || ''; area.action.data = target ? `switch:${target.alias_id}` : ''; dirtyRender(); });
  }

  function renderHistory() {
    const versions = state.studio.versions || [], runs = state.studio.publishRuns || [];
    document.getElementById('sms-history-grid').innerHTML = `<div><b>版本紀錄</b>${versions.length ? versions.map(version => `<div class="sms-history-item"><div><b>${esc(version.name)}</b><small>${esc(version.line_rich_menu_id || '尚無 LINE ID')}</small></div><span class="sms-status">${esc(version.status)}</span></div>`).join('') : '<p class="muted">尚無版本</p>'}</div><div><b>上架紀錄</b>${runs.length ? runs.map(run => `<div class="sms-history-item"><div><b>${esc(run.stage)}</b><small>${esc(fmt(run.started_at))}${run.error_message ? ` · ${esc(run.error_message)}` : ''}</small></div><span class="sms-status">${esc(run.status)}</span></div>`).join('') : '<p class="muted">尚無紀錄</p>'}</div>`;
  }

  async function openPublishDialog(projectId, saveFirst = false) {
    let project = state.projects.find(item => item.id === projectId) || state.studio?.project;
    if (!project) { const data = await api(`/api/admin/rich-menu/projects/${encodeURIComponent(projectId)}`); project = data.project; }
    const definition = state.definition || project.definition;
    const modal = document.createElement('div');
    modal.className = 'sms-publish-modal';
    modal.innerHTML = `<div class="sms-publish-dialog" role="dialog" aria-modal="true"><div class="eyebrow">準備發布</div><h2>發布圖文選單</h2><p>確認要將目前專案發布，並切換為該 LINE 官方帳號目前使用中的選單嗎？</p><dl><dt>專案名稱</dt><dd>${esc(project.name)}</dd><dt>圖片尺寸</dt><dd>${definition?.size?.width || project.width} × ${definition?.size?.height || project.height}</dd><dt>點擊區域</dt><dd>${definition?.areas?.length ?? project.area_count ?? 0} 個</dd><dt>LINE 官方帳號</dt><dd>Joson Care 已連結帳號</dd></dl><div class="sms-callout warn">新版建立、圖片上傳與預設切換完成前，系統不會移除舊版。</div><footer><button class="sms-btn" data-close>取消</button><button class="sms-btn publish" data-confirm>確認發布</button></footer></div>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-close]').onclick = () => modal.remove();
    modal.querySelector('[data-confirm]').onclick = async event => {
      event.currentTarget.disabled = true; event.currentTarget.textContent = '發布中…';
      try {
        if (saveFirst) await saveProject(projectId, false);
        const result = await api(`/api/admin/rich-menu/projects/${encodeURIComponent(projectId)}/publish`, { method: 'POST' });
        modal.querySelector('.sms-publish-dialog').innerHTML = `<div class="eyebrow">發布成功</div><h2>圖文選單已上架</h2><div class="sms-callout">✓ <span>已建立並驗證 LINE Rich Menu，且已切換為目前使用中的選單。</span></div><dl><dt>Rich Menu ID</dt><dd style="overflow-wrap:anywhere">${esc(result.newRichMenuId)}</dd><dt>版本 ID</dt><dd style="overflow-wrap:anywhere">${esc(result.versionId)}</dd></dl><footer><button class="sms-btn primary" data-finish>完成</button></footer>`;
        modal.querySelector('[data-finish]').onclick = () => { modal.remove(); navigate(state.view === 'project-editor' ? 'project-editor' : 'projects', state.view === 'project-editor' ? projectId : ''); };
      } catch (error) { toast(`發布失敗：${error.message}`, true); event.currentTarget.disabled = false; event.currentTarget.textContent = '重新發布'; }
    };
  }

  async function renderTemplateEditor(templateId = '') {
    await loadCatalog();
    let template;
    if (templateId) template = (await api(`/api/admin/rich-menu/templates/${encodeURIComponent(templateId)}`)).template;
    else {
      const source = state.templates.find(item => item.status === 'active');
      if (!source) throw new Error('請先建立至少一套基礎模板');
      template = { name: '', description: '', image_url: source.image_url, default_image_path: source.default_image_path, definition: structuredClone(source.definition), status: 'active' };
    }
    state.template = template; state.definition = structuredClone(template.definition); state.activeArea = 0; state.studio = { switchTargets: state.projects.filter(project => project.status !== 'archived') };
    root.innerHTML = `<div class="sms-editor"><header class="sms-editor-head"><div class="sms-editor-title"><button class="sms-btn" id="sms-template-back">←</button><div><input id="sms-editor-name" maxlength="120" value="${esc(template.name)}" placeholder="輸入模板名稱"><small>模板製作模式：座標、Action 與導航規則只需設定一次</small></div></div><div class="sms-editor-tools"><input id="sms-template-image-input" type="file" accept="image/png,image/jpeg" hidden><button class="sms-btn" id="sms-template-image">▧ 更換模板圖片</button><button class="sms-btn" id="sms-template-draft">儲存模板草稿</button><button class="sms-btn primary" id="sms-template-save">驗證並加入模板庫</button></div></header><div class="sms-editor-grid"><section class="sms-editor-left"><div class="sms-intro"><h3>模板內容設定</h3><p>建立可重複使用的圖片、座標、區域名稱與 Action 母版。</p></div><div class="sms-meta"><label>模板說明<input id="sms-template-description" maxlength="500" value="${esc(template.description || '')}"></label><label>LINE 選單名稱<input id="sms-menu-name" maxlength="300" value="${esc(state.definition.name)}"></label><label>聊天列文字<input id="sms-chatbar" maxlength="14" value="${esc(state.definition.chatBarText)}"></label><label class="sms-check"><input id="sms-selected" type="checkbox" ${state.definition.selected ? 'checked' : ''}> 預設展開選單</label></div><div class="sms-area-tabs" id="sms-area-tabs"></div><div class="sms-action-card"><h4 id="sms-action-title"></h4><small id="sms-action-help"></small><div class="sms-action-form" id="sms-action-form"></div></div></section><aside class="sms-editor-right"><div class="sms-phone"><div class="sms-phone-head">LINE 預覽</div><div class="sms-canvas" id="sms-canvas"><img id="sms-canvas-image" src="${esc(template.image_url)}" alt=""><div id="sms-hotspots"></div></div><div class="sms-phone-foot">${esc(state.definition.chatBarText)}</div></div></aside></div></div>`;
    document.getElementById('sms-template-back').onclick = () => navigate('templates');
    document.getElementById('sms-template-draft').onclick = () => saveTemplate(templateId, 'draft');
    document.getElementById('sms-template-save').onclick = () => saveTemplate(templateId, 'verified');
    document.getElementById('sms-template-image').onclick = () => document.getElementById('sms-template-image-input').click();
    document.getElementById('sms-template-image-input').onchange = async event => {
      const file = event.target.files[0]; if (!file) return;
      const form = new FormData(); form.append('image', file);
      try { const result = await api('/api/admin/rich-menu/upload-image', { method: 'POST', body: form }); const oldWidth = state.definition.size.width, oldHeight = state.definition.size.height; state.definition.areas.forEach(area => { area.bounds.x = Math.round(area.bounds.x * result.asset.width / oldWidth); area.bounds.y = Math.round(area.bounds.y * result.asset.height / oldHeight); area.bounds.width = Math.round(area.bounds.width * result.asset.width / oldWidth); area.bounds.height = Math.round(area.bounds.height * result.asset.height / oldHeight); }); state.definition.size = { width: result.asset.width, height: result.asset.height }; state.template.default_image_path = result.asset.imagePath; document.getElementById('sms-canvas-image').src = `${result.asset.imagePath}?v=${Date.now()}`; renderAreaEditor(templateId || 'template'); toast('模板圖片已上傳，熱區已依新尺寸等比例調整。'); }
      catch (error) { toast(error.message, true); }
      finally { event.target.value = ''; }
    };
    renderAreaEditor(templateId || 'template');
  }

  async function saveTemplate(templateId, verificationStatus) {
    state.definition.name = document.getElementById('sms-menu-name').value.trim(); state.definition.chatBarText = document.getElementById('sms-chatbar').value.trim(); state.definition.selected = document.getElementById('sms-selected').checked;
    const payload = { name: document.getElementById('sms-editor-name').value.trim(), description: document.getElementById('sms-template-description').value.trim(), imagePath: state.template.default_image_path || state.template.image_url, definition: state.definition, status: 'active', verificationStatus };
    if (!payload.name) return toast('請輸入模板名稱。', true);
    try { const data = await api(templateId ? `/api/admin/rich-menu/templates/${encodeURIComponent(templateId)}` : '/api/admin/rich-menu/templates', { method: templateId ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }); toast(verificationStatus === 'draft' ? '模板草稿已儲存。' : '模板已驗證並加入模板庫。'); await navigate('template-editor', templateId || data.templateId); }
    catch (error) { toast(error.message, true); }
  }

  tabs.forEach(button => button.onclick = () => navigate(button.dataset.view));
  const params = new URLSearchParams(location.search);
  const initialView = ['projects', 'templates', 'project-builder', 'project-editor', 'template-editor'].includes(params.get('view')) ? params.get('view') : 'projects';
  navigate(initialView, params.get('id') || '');
})();
