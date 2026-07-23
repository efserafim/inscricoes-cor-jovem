
  const STATUS_LABEL = {
    nova: 'Nova',
    confirmada: 'Confirmado(a)',
    lista_espera: 'Espera',
    cancelada: 'Cancelada'
  };

  const gate = document.getElementById('gate');
  const app = document.getElementById('app');
  const tbody = document.getElementById('tbody');
  const empty = document.getElementById('empty');
  const overlay = document.getElementById('overlay');
  const drawer = document.getElementById('drawer');
  const toastEl = document.getElementById('toast');

  let rows = [];
  let servoRows = [];
  let decurias = [];
  let selectedId = null;
  let selectedServoId = null;
  let drawerMode = 'inscricao';
  let statusFilter = '';
  let servoStatusFilter = '';
  let quickFilter = '';
  let toastTimer = null;
  let editing = false;
  const gateErr = document.getElementById('gateErr');
  try { sessionStorage.removeItem('cor-jovem-dash-auth'); } catch (_) {}
