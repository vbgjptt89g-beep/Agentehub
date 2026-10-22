const modal = document.querySelector('#task-modal');
const promptField = document.querySelector('#task-prompt');
const toast = document.querySelector('#toast');
let toastTimer;
const githubState = { authenticated: false, user: null, repos: [], selectedRepo: '', demo: false, tasks: [] };
githubState.scopes = [];

const demoIssues = [
  { number: 128, title: 'Añadir modo oscuro al panel de proyectos', updatedAt: new Date(Date.now() - 1000 * 60 * 34).toISOString(), labels: ['enhancement'] },
  { number: 124, title: 'Corregir reintentos de webhooks de GitHub', updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), labels: ['bug'] },
  { number: 119, title: 'Documentar configuración de proveedores de IA', updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), labels: ['docs'] }
];
const demoPulls = [
  { number: 42, title: 'feat: vista previa de cambios del agente', head: 'agent/preview-diff', base: 'main', draft: true, htmlUrl: '#' },
  { number: 39, title: 'fix: reintentar webhook con backoff exponencial', head: 'fix/webhook-retry', base: 'main', draft: false, htmlUrl: '#' }
];

function announce(message, duration = 2600) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

function openModal() {
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => promptField.focus(), 30);
}

function closeModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function taskRunRow(task) {
  const row = document.createElement('article');
  row.className = 'run-row';
  const avatarClass = task.model.startsWith('Codex') ? 'codex' : 'claude';
  const avatarGlyph = avatarClass === 'codex' ? '⌘' : '✳';
  row.innerHTML = `<div class="agent-avatar ${avatarClass}">${avatarGlyph}</div><div class="run-info"><div class="run-title"><b></b><span class="run-state"><i></i> ${task.status === 'running' ? 'En ejecución' : 'En cola'}</span></div><div class="run-meta"><span class="repo-label"><span class="project-dot dot-cyan"></span></span><span>·</span><span></span></div><div class="run-progress"><div><i style="width:${task.status === 'running' ? '64%' : '2%'}"></i></div><span>${task.status === 'running' ? '64%' : '0%'}</span><small></small></div></div><button class="more-button" aria-label="Cancelar tarea pendiente" title="Cancelar tarea pendiente">×</button>`;
  row.querySelector('.run-title>b').textContent = task.title;
  row.querySelector('.repo-label').append(document.createTextNode(task.repository.split('/').pop()));
  row.querySelector('.run-meta > span:last-child').textContent = task.model;
  row.querySelector('.run-progress small').textContent = new Date(task.createdAt).toLocaleString();
  row.dataset.taskId = task.id;
  row.querySelector('.more-button').addEventListener('click', async () => {
    const button = row.querySelector('.more-button');
    button.disabled = true;
    try {
      if (githubState.demo) githubState.tasks = githubState.tasks.filter(item => item.id !== task.id);
      else await api(`/api/tasks?id=${encodeURIComponent(task.id)}`, { method: 'PATCH' });
      row.querySelector('.run-state').lastChild.textContent = ' Cancelada';
      row.querySelector('.run-state i').style.background = '#999';
      button.remove();
      announce('Tarea pendiente cancelada.');
    } catch (error) {
      announce(error.message);
      button.disabled = false;
    }
  });
  return row;
}

document.querySelector('#new-task').addEventListener('click', openModal);
document.querySelector('.close-modal').addEventListener('click', closeModal);
modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeModal();
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    announce('Búsqueda global · próximamente');
  }
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') openModal();
});

document.querySelector('#launch-task').addEventListener('click', async () => {
  const title = promptField.value.trim();
  if (!title) {
    promptField.focus();
    promptField.setCustomValidity('Describe la tarea antes de iniciarla.');
    promptField.reportValidity();
    promptField.addEventListener('input', () => promptField.setCustomValidity(''), { once: true });
    return;
  }
  if ((!githubState.authenticated && !githubState.demo) || !githubState.repos.length) {
    announce('Conecta una cuenta de GitHub con al menos un repositorio público antes de continuar.');
    return;
  }
  const repository = document.querySelector('#repo-select').value;
  const model = document.querySelector('#model-select').value;
  const launchButton = document.querySelector('#launch-task');
  launchButton.disabled = true;
  try {
  const issue = document.querySelector('#issue-input').value.trim();
  const task = githubState.demo
    ? { id: `demo-${Date.now()}`, title, prompt: title, repository, model, issueNumber: Number(issue.match(/#(\d+)/)?.[1]) || null, status: 'queued', createdAt: new Date().toISOString() }
    : await api('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, prompt: title, repository, model, issue }) });
  if (githubState.demo) githubState.tasks.unshift(task);
  const row = taskRunRow(task);
  document.querySelector('.running-list').prepend(row);
  const count = document.querySelector('.section-heading h2 .count-pill');
  count.textContent = String(Number(count.textContent) + 1);
  closeModal();
  promptField.value = '';
  document.querySelector('#issue-input').value = '';
  announce(githubState.demo ? 'Tarea de demostración añadida a la cola local.' : 'Tarea guardada. Quedó en cola; falta activar el worker de ejecución.');
  } catch (error) {
    announce(error.message);
  } finally {
    launchButton.disabled = false;
  }
});

document.querySelectorAll('.nav-item[data-view], .text-button[data-view]').forEach(button => {
  button.addEventListener('click', () => {
    showView(button.dataset.view);
  });
});
document.querySelector('[data-settings-link]').addEventListener('click', () => showView('settings'));

document.querySelector('.search-trigger').addEventListener('click', () => announce('Búsqueda global · próximamente'));
document.querySelector('.notification-button').addEventListener('click', () => announce('No tienes notificaciones nuevas.'));
document.querySelector('.filter-button').addEventListener('click', () => announce('Mostrando actividad de los últimos 7 días.'));
document.querySelector('.connect-model').addEventListener('click', () => announce('Conecta Anthropic, OpenAI u Ollama desde Configuración.'));
document.querySelector('.small-plus').addEventListener('click', () => announce('Conecta Anthropic, OpenAI u Ollama desde Configuración.'));

async function api(path, options) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
  return data;
}

function currentRepo() {
  return githubState.repos.find(repo => repo.fullName === githubState.selectedRepo) || null;
}

function selectRepository(fullName) {
  githubState.selectedRepo = fullName;
  document.querySelectorAll('.project-link').forEach(item => item.classList.toggle('selected', item.dataset.repo === fullName));
  const select = document.querySelector('#repo-select');
  if ([...select.options].some(option => option.value === fullName)) select.value = fullName;
  loadIssues(fullName).catch(() => {});
  if (githubState.authenticated) refreshDashboard().catch(error => announce(error.message));
}

async function loadIssues(fullName) {
  if (!githubState.authenticated || !fullName) return [];
  const issues = await api(`/api/github/issues?repo=${encodeURIComponent(fullName)}`);
  const datalist = document.querySelector('#issue-options');
  datalist.replaceChildren(...issues.map(issue => {
    const option = document.createElement('option');
    option.value = `#${issue.number} ${issue.title}`;
    return option;
  }));
  return issues;
}

function renderRepositories() {
  const nav = document.querySelector('.project-nav');
  const select = document.querySelector('#repo-select');
  nav.replaceChildren();
  select.replaceChildren();
  if (!githubState.repos.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No hay repositorios públicos';
    select.append(option);
    return;
  }
  for (const repo of githubState.repos) {
    const option = document.createElement('option');
    option.value = repo.fullName;
    option.textContent = repo.fullName;
    select.append(option);
  }
  githubState.repos.slice(0, 12).forEach((repo, index) => {
    const button = document.createElement('button');
    button.className = `project-link${repo.fullName === githubState.selectedRepo ? ' selected' : ''}`;
    button.dataset.repo = repo.fullName;
    const dot = document.createElement('span');
    dot.className = `project-dot ${['dot-cyan', 'dot-orange', 'dot-lilac'][index % 3]}`;
    const name = document.createElement('span');
    name.textContent = repo.name;
    const count = document.createElement('small');
    count.textContent = String(repo.openIssuesCount || 0);
    button.append(dot, name, count);
    button.addEventListener('click', () => {
      selectRepository(repo.fullName);
      announce(`Proyecto seleccionado: ${repo.fullName}`);
    });
    nav.append(button);
  });
  select.value = githubState.selectedRepo;
  selectRepository(select.value);
}

function setConnectedUser(user, scopes = []) {
  const connectLink = document.querySelector('#github-connect');
  connectLink.classList.add('hidden');
  document.querySelector('#github-logout-form').classList.remove('hidden');
  document.querySelector('.top-avatar').textContent = (user.login || 'GH').slice(0, 2).toUpperCase();
  document.querySelector('.top-avatar').title = user.login;
  document.querySelector('.user-avatar').textContent = (user.login || 'GH').slice(0, 2).toUpperCase();
  document.querySelector('.user-copy b').textContent = user.name || user.login;
  document.querySelector('.user-copy small').textContent = `@${user.login}`;
  document.querySelector('.workspace-copy b').textContent = user.login;
  document.querySelector('#workspace-subtitle').textContent = 'Cuenta de GitHub conectada';
  document.querySelector('#breadcrumb-workspace').textContent = user.login;
  document.querySelector('.page-footer>span:last-child').innerHTML = '<i></i> GitHub conectado';
}

async function refreshDashboard() {
  if (!githubState.authenticated) return;
  const issuesPromise = loadIssues(githubState.selectedRepo);
  const pullsPromise = githubState.selectedRepo
    ? api(`/api/github/pulls?repo=${encodeURIComponent(githubState.selectedRepo)}`).catch(() => [])
    : Promise.resolve([]);
  let tasksUnavailable = false;
  const tasksPromise = githubState.selectedRepo
    ? api(`/api/tasks?repo=${encodeURIComponent(githubState.selectedRepo)}`).catch(() => { tasksUnavailable = true; return []; })
    : Promise.resolve([]);
  const [issues, pulls, tasks] = await Promise.all([issuesPromise, pullsPromise, tasksPromise]);
  document.querySelector('#dashboard-status').textContent = tasksUnavailable
    ? `GitHub conectado · datos actuales de ${githubState.selectedRepo || 'tus repositorios'}. Configura DATABASE_URL para activar la cola persistente.`
    : `GitHub conectado · datos actuales de ${githubState.selectedRepo || 'tus repositorios'}. Las tareas guardadas esperan a que se active el worker.`;
  document.querySelector('#dashboard-status').classList.add('connected-banner');
  const metrics = document.querySelectorAll('.metric-value');
  if (metrics[0]) metrics[0].textContent = String(tasks.filter(task => ['queued', 'running'].includes(task.status)).length);
  if (metrics[1]) metrics[1].textContent = String(pulls.length);
  if (metrics[2]) metrics[2].textContent = '—';
  if (metrics[3]) metrics[3].textContent = '$0.00';
  const metricLabels = document.querySelectorAll('.metric-label');
  if (metricLabels[0]) metricLabels[0].childNodes[0].textContent = 'Tareas pendientes ';
  if (metricLabels[1]) metricLabels[1].childNodes[0].textContent = 'PRs abiertos ';
  if (metricLabels[2]) metricLabels[2].childNodes[0].textContent = 'Tests de agentes ';
  if (metricLabels[3]) metricLabels[3].childNodes[0].textContent = 'Costo registrado ';
  const metricFoots = document.querySelectorAll('.metric-foot');
  ['Workers pendientes', 'En este repositorio', 'Se mostrará al activar agentes', 'Sin ejecuciones'].forEach((label, index) => {
    if (metricFoots[index]) metricFoots[index].textContent = label;
  });
  const count = document.querySelector('.section-heading h2 .count-pill');
  if (count) count.textContent = String(tasks.length);
  const taskNavCount = document.querySelector('.nav-item[data-view="tasks"] .nav-count');
  if (taskNavCount) taskNavCount.textContent = String(tasks.length);
  const pullNavCount = document.querySelector('.nav-item[data-view="pull-requests"] .nav-count');
  if (pullNavCount) pullNavCount.textContent = String(pulls.length);
  const runList = document.querySelector('#running-list');
  runList.replaceChildren();
  if (tasks.length) tasks.slice(0, 8).forEach(task => runList.append(taskRunRow(task)));
  else {
    const noRuns = document.createElement('p');
    noRuns.className = 'empty-state';
    noRuns.textContent = 'Aún no hay tareas guardadas para este repositorio.';
    runList.append(noRuns);
  }
  const tableBody = document.querySelector('.activity-table tbody');
  tableBody.replaceChildren();
  issues.slice(0, 5).forEach(issue => {
    const row = document.createElement('tr');
    const taskCell = document.createElement('td');
    const icon = document.createElement('span');
    icon.className = 'table-task-icon review';
    icon.textContent = '#';
    const task = document.createElement('span');
    task.className = 'table-task';
    const title = document.createElement('b');
    title.textContent = issue.title;
    const detail = document.createElement('small');
    detail.textContent = `${githubState.selectedRepo} · #${issue.number}`;
    task.append(title, detail);
    taskCell.append(icon, task);
    const provider = document.createElement('td'); provider.textContent = 'GitHub';
    const status = document.createElement('td'); status.innerHTML = '<span class="status-chip review"><i></i> Issue abierto</span>';
    const time = document.createElement('td'); time.textContent = new Date(issue.updatedAt).toLocaleDateString();
    row.append(taskCell, provider, status, time); tableBody.append(row);
  });
  document.querySelector('.timeline').replaceChildren();
  const emptyTimeline = document.createElement('p');
  emptyTimeline.className = 'empty-state';
  emptyTimeline.textContent = 'La actividad de agentes aparecerá aquí cuando conectes un proveedor.';
  document.querySelector('.timeline').append(emptyTimeline);
}

async function loadGitHub() {
  try {
    const auth = await api('/api/auth/me');
    githubState.authenticated = auth.authenticated;
    if (!auth.authenticated) {
      startDemoMode();
      return;
    }
    githubState.user = auth.user;
    githubState.scopes = auth.scopes || [];
    setConnectedUser(auth.user, githubState.scopes);
    githubState.repos = await api('/api/github/repos');
    githubState.selectedRepo = githubState.repos[0]?.fullName || '';
    renderRepositories();
  } catch {
    startDemoMode();
  }
}

function startDemoMode() {
  githubState.demo = true;
  githubState.repos = [
    { fullName: 'acme/launchpad', name: 'launchpad', defaultBranch: 'main', openIssuesCount: 12, private: false, htmlUrl: '#' },
    { fullName: 'acme/design-system', name: 'design-system', defaultBranch: 'main', openIssuesCount: 5, private: false, htmlUrl: '#' },
    { fullName: 'acme/api-platform', name: 'api-platform', defaultBranch: 'develop', openIssuesCount: 8, private: false, htmlUrl: '#' }
  ];
  githubState.selectedRepo = githubState.repos[0].fullName;
  githubState.tasks = [
    { id: 'demo-task-1', title: 'Añadir búsqueda global al dashboard', repository: 'acme/launchpad', model: 'Claude Sonnet 4', status: 'running', createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString() },
    { id: 'demo-task-2', title: 'Corregir reintentos de webhooks', repository: 'acme/launchpad', model: 'Codex · GPT-5', status: 'queued', createdAt: new Date(Date.now() - 1000 * 60 * 4).toISOString() }
  ];
  renderRepositories();
  renderDemoDashboard();
  document.querySelector('#dashboard-status').textContent = 'Modo demostración · datos de ejemplo; tus repositorios reales aparecerán al conectar GitHub.';
  document.querySelector('.page-footer>span:last-child').innerHTML = '<i></i> Demo interactiva · sin cambios en GitHub';
  document.querySelector('.user-copy b').textContent = 'Invitado';
  document.querySelector('.user-copy small').textContent = 'Modo demostración';
  document.querySelector('.user-avatar').textContent = 'D';
  document.querySelector('.top-avatar').textContent = 'D';
  document.querySelector('#workspace-subtitle').textContent = 'Explorando datos de ejemplo';
  document.querySelector('.usage-title>span:last-child').textContent = '$2.36 / $10';
  document.querySelector('.usage-block>small').textContent = '24% · cifras ilustrativas';
  document.querySelector('.usage-track i').style.width = '24%';
  document.querySelector('.section-heading h2').childNodes[0].textContent = 'Tareas de agentes ';
  document.querySelector('.section-heading h2').nextElementSibling.textContent = 'Ejemplo de ejecución · no se ha iniciado ningún agente real';
  document.querySelector('.stream-live').innerHTML = '<i></i> DEMO';
}

function renderDemoDashboard() {
  const values = document.querySelectorAll('.metric-value');
  ['2', String(demoPulls.length), '8', '$2.36'].forEach((value, index) => { values[index].textContent = value; });
  const labels = document.querySelectorAll('.metric-foot');
  ['1 agente en ejecución · 1 en cola', 'En acme/launchpad', '6 aprobados · 2 pendientes', 'Estimación de esta demo'].forEach((value, index) => { labels[index].textContent = value; });
  document.querySelector('.section-heading h2 .count-pill').textContent = String(githubState.tasks.length);
  document.querySelector('.nav-item[data-view="tasks"] .nav-count').textContent = String(githubState.tasks.length);
  document.querySelector('.nav-item[data-view="pull-requests"] .nav-count').textContent = String(demoPulls.length);
  const list = document.querySelector('#running-list');
  list.replaceChildren(...githubState.tasks.map(taskRunRow));
  const body = document.querySelector('.activity-table tbody');
  body.replaceChildren(...demoIssues.map(issue => {
    const row = document.createElement('tr');
    row.innerHTML = `<td><span class="table-task-icon review">#</span><span class="table-task"><b></b><small></small></span></td><td>GitHub</td><td><span class="status-chip review"><i></i> Issue abierto</span></td><td></td>`;
    row.querySelector('.table-task b').textContent = issue.title;
    row.querySelector('.table-task small').textContent = `${githubState.selectedRepo} · #${issue.number}`;
    row.lastElementChild.textContent = new Date(issue.updatedAt).toLocaleDateString();
    return row;
  }));
  const timeline = document.querySelector('.timeline');
  timeline.replaceChildren();
  [
    ['Claude Sonnet 4', 'Abrió una propuesta de cambios para la búsqueda global.', 'hace 2 min'],
    ['Checks', '6 de 8 pruebas pasaron en feat/global-search.', 'hace 8 min'],
    ['Codex · GPT-5', 'Tomó la tarea de reintentos de webhooks.', 'hace 12 min']
  ].forEach(([name, detail, time]) => {
    const item = document.createElement('div'); item.className = 'timeline-item';
    const marker = document.createElement('i'); marker.className = 'timeline-marker';
    const copy = document.createElement('div');
    const title = document.createElement('b'); title.textContent = name;
    const text = document.createElement('p'); text.textContent = detail;
    const date = document.createElement('small'); date.textContent = time;
    copy.append(title, text, date); item.append(marker, copy); timeline.append(item);
  });
}

const viewTitles = { overview: 'Visión general', tasks: 'Tareas', 'pull-requests': 'Pull requests', repositories: 'Repositorios', settings: 'Configuración' };
async function showView(view) {
  const title = viewTitles[view] || viewTitles.overview;
  document.querySelector('#breadcrumb-current').textContent = title;
  document.querySelectorAll('.nav-item[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === view));
  const dashboard = document.querySelector('#dashboard-view');
  const panel = document.querySelector('#data-view');
  dashboard.classList.toggle('hidden', view !== 'overview');
  panel.classList.toggle('hidden', view === 'overview');
  if (view === 'overview') return;
  panel.replaceChildren();
  const heading = document.createElement('div');
  heading.className = 'data-heading';
  const titleElement = document.createElement('h1');
  titleElement.textContent = title;
  const intro = document.createElement('p');
  intro.textContent = githubState.demo ? 'Demostración interactiva · datos ficticios, sin cambios externos.' : githubState.authenticated ? `Datos en vivo de GitHub · ${githubState.selectedRepo || 'selecciona un repositorio'}` : 'Conecta GitHub para ver tus datos reales.';
  heading.append(titleElement, intro);
  panel.append(heading);
  if (!githubState.authenticated && !githubState.demo) {
    const link = document.createElement('a');
    link.href = '/api/auth/login';
    link.className = 'primary-button';
    link.textContent = 'Conectar GitHub';
    panel.append(link);
    return;
  }
  try {
    let rows = [];
    if (githubState.demo) {
      if (view === 'repositories') rows = githubState.repos.map(repo => ({ title: repo.fullName, meta: `Público · rama ${repo.defaultBranch} · ${repo.openIssuesCount} issues abiertos`, href: repo.htmlUrl }));
      if (view === 'tasks') rows = githubState.tasks.map(task => ({ title: task.title, meta: `${task.status === 'queued' ? 'En cola' : 'En ejecución'} · ${task.repository} · ${task.model} · ${new Date(task.createdAt).toLocaleString()}` }));
      if (view === 'pull-requests') rows = demoPulls.map(pull => ({ title: `#${pull.number} · ${pull.title}`, meta: `${pull.draft ? 'Borrador' : 'Abierto'} · ${pull.head} → ${pull.base}`, href: pull.htmlUrl }));
      if (view === 'settings') rows = [
        { title: 'Modo de demostración', meta: 'Datos ficticios locales para explorar la interfaz. No se escribe en GitHub ni se ejecutan agentes reales.' },
        { title: 'GitHub OAuth', meta: 'Conecta una cuenta para consultar tus repositorios e issues.' },
        { title: 'Proveedores de IA', meta: 'Anthropic y OpenAI requieren configurar credenciales de servidor.' },
        { title: 'Sandbox', meta: 'La ejecución aislada todavía no está habilitada.' }
      ];
    }
    if (githubState.demo && view === 'repositories') {
      const list = document.createElement('div'); list.className = 'data-list';
      rows.forEach(item => { const row = document.createElement('div'); row.className = 'data-row'; const copy = document.createElement('div'); const name = document.createElement('b'); name.textContent = item.title; const meta = document.createElement('small'); meta.textContent = item.meta; copy.append(name, meta); row.append(copy); list.append(row); });
      panel.append(list); return;
    }
    if (!githubState.demo && view === 'repositories') rows = githubState.repos.map(repo => ({ title: repo.fullName, meta: `${repo.private ? 'Privado' : 'Público'} · rama ${repo.defaultBranch} · ${repo.openIssuesCount || 0} issues abiertos`, href: repo.htmlUrl }));
    if (!githubState.demo && view === 'tasks') {
      const tasks = await api(`/api/tasks?repo=${encodeURIComponent(githubState.selectedRepo)}`);
      rows = tasks.map(task => ({ title: task.issueNumber ? `#${task.issueNumber} · ${task.title}` : task.title, meta: `${task.status === 'queued' ? 'En cola' : task.status} · ${task.repository} · ${task.model} · ${new Date(task.createdAt).toLocaleString()}` }));
    }
    if (!githubState.demo && view === 'pull-requests') {
      if (!githubState.selectedRepo) throw new Error('Selecciona primero un repositorio.');
      const pulls = await api(`/api/github/pulls?repo=${encodeURIComponent(githubState.selectedRepo)}`);
      rows = pulls.map(pull => ({ title: `#${pull.number} · ${pull.title}`, meta: `${pull.draft ? 'Borrador' : 'Abierto'} · ${pull.head} → ${pull.base}`, href: pull.htmlUrl }));
    }
    if (!githubState.demo && view === 'settings') {
      rows = [
        { title: 'GitHub OAuth', meta: `Conectado como @${githubState.user.login} · permisos: ${githubState.scopes.join(', ') || 'repositorios públicos'}` },
        { title: 'Anthropic y OpenAI', meta: 'Los proveedores todavía no están conectados. Las API keys se añadirán como ANTHROPIC_API_KEY y OPENAI_API_KEY en Vercel.' },
        { title: 'Ejecución de tareas', meta: 'Las tareas se guardan por usuario en PostgreSQL y quedan en cola hasta activar un worker.' },
        { title: 'Sandbox', meta: 'La ejecución aislada aún no está habilitada. No se ejecuta código del repositorio desde la web.' },
        { title: 'Costos y equipos', meta: 'PostgreSQL, límites de gasto y roles de equipo quedan para la siguiente etapa.' }
      ];
    }
    if (!githubState.demo && view === 'repositories' && githubState.selectedRepo) {
      const branches = await api(`/api/github/branches?repo=${encodeURIComponent(githubState.selectedRepo)}`);
      rows.unshift(...branches.map(branch => ({ title: branch.name, meta: `${branch.protected ? 'Protegida' : 'Rama'} · ${branch.sha.slice(0, 7)}` })));
    }
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = view === 'tasks' ? 'No hay tareas guardadas para este repositorio.' : view === 'pull-requests' ? 'No hay pull requests abiertos.' : 'No encontramos elementos para mostrar.';
      panel.append(empty);
      return;
    }
    const list = document.createElement('div');
    list.className = 'data-list';
    rows.forEach(item => {
      const row = document.createElement(item.href ? 'a' : 'div');
      row.className = 'data-row';
      if (item.href) { row.href = item.href; row.target = '_blank'; row.rel = 'noreferrer'; }
      const copy = document.createElement('div');
      const name = document.createElement('b');
      name.textContent = item.title;
      const detail = document.createElement('small');
      detail.textContent = item.meta;
      copy.append(name, detail);
      row.append(copy);
      if (item.issue) {
        const assign = document.createElement('button');
        assign.className = 'secondary-button';
        assign.textContent = 'Preparar tarea';
        assign.addEventListener('click', event => {
          event.preventDefault(); event.stopPropagation();
          document.querySelector('#repo-select').value = githubState.selectedRepo;
          promptField.value = item.issue.title;
          document.querySelector('#issue-input').value = `#${item.issue.number} ${item.issue.title}`;
          openModal();
        });
        row.append(assign);
      }
      list.append(row);
    });
    panel.append(list);
  } catch (error) {
    const message = document.createElement('p');
    message.className = 'empty-state error-state';
    message.textContent = error.message;
    panel.append(message);
  }
}

document.querySelector('#github-logout-form').addEventListener('submit', async event => {
  event.preventDefault();
  try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
  window.location.href = '/';
});

document.querySelector('#repo-select').addEventListener('change', event => selectRepository(event.target.value));

loadGitHub();
const authResult = new URLSearchParams(window.location.search).get('auth');
if (authResult === 'connected') announce('GitHub conectado. Tus repositorios ya están disponibles.');
if (authResult === 'github-error') announce('No se pudo completar la conexión con GitHub.');
if (authResult === 'configuration-error') announce('Configura GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_OAUTH_CALLBACK_URL y AGENTHUB_SESSION_SECRET en Vercel para conectar GitHub.', 6500);
if (authResult) window.history.replaceState({}, '', window.location.pathname);

