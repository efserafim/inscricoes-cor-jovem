
(function(){
  const overlay = document.getElementById('adminUsersOverlay');
  if(!overlay || !window.COR_AUTH) return;

  const listEl = document.getElementById('adminUsersList');
  const errEl = document.getElementById('adminUsersErr');
  const form = document.getElementById('adminResetForm');
  const emailSel = document.getElementById('adminResetEmail');
  const passInput = document.getElementById('adminResetPass');
  const submitBtn = document.getElementById('adminResetSubmit');
  const openBtn = document.getElementById('adminUsersBtn');

  function showErr(msg){
    errEl.textContent = msg || 'Não foi possível concluir.';
    errEl.classList.add('show');
  }

  function clearErr(){
    errEl.classList.remove('show');
  }

  function roleLabel(role){
    const r = String(role || '').toLowerCase();
    if(r === 'admin') return 'Admin';
    if(r === 'tesoureiro') return 'Tesoureiro';
    return 'Equipe';
  }

  function renderUsers(users){
    listEl.innerHTML = '';
    emailSel.innerHTML = '<option value="">Selecione o usuário</option>';
    (users || []).forEach(u => {
      const li = document.createElement('li');
      li.className = 'admin-user-item';
      li.innerHTML =
        '<div class="admin-user-main">' +
          '<strong>' + (u.display_name || u.email || 'Sem nome') + '</strong>' +
          '<span class="admin-user-email">' + (u.email || '') + '</span>' +
        '</div>' +
        '<div class="admin-user-meta">' +
          '<span class="pill pill-role">' + roleLabel(u.role) + '</span>' +
          (u.must_change_password ? '<span class="pill pill-warn">Trocar senha</span>' : '') +
        '</div>';
      listEl.appendChild(li);

      const opt = document.createElement('option');
      opt.value = u.email || '';
      opt.textContent = (u.display_name ? u.display_name + ' — ' : '') + (u.email || '');
      emailSel.appendChild(opt);
    });
  }

  async function loadUsers(){
    clearErr();
    listEl.innerHTML = '<li class="admin-user-loading">Carregando…</li>';
    try{
      const users = await window.COR_AUTH.adminListUsers();
      renderUsers(users);
    }catch(ex){
      console.error(ex);
      listEl.innerHTML = '';
      showErr((ex && ex.message) || 'Não foi possível carregar a equipe.');
    }
  }

  function openModal(){
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    loadUsers();
    setTimeout(() => emailSel.focus(), 50);
  }

  function closeModal(){
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    form.reset();
    clearErr();
  }

  window.setupAdminUsersUi = function(){
    if(!window.COR_AUTH.isAdmin()){
      if(openBtn) openBtn.hidden = true;
      return;
    }
    if(openBtn) openBtn.hidden = false;
  };

  if(openBtn){
    openBtn.addEventListener('click', openModal);
  }
  document.getElementById('adminUsersClose')?.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if(e.target === overlay) closeModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErr();
    const email = emailSel.value.trim();
    const password = passInput.value;
    if(!email){
      showErr('Selecione um usuário.');
      return;
    }
    if(password.length < 6){
      showErr('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    const ok = confirm('Redefinir a senha de ' + email + '?\n\nA pessoa precisará trocar a senha no próximo acesso.');
    if(!ok) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando…';
    try{
      await window.COR_AUTH.adminResetPassword(email, password);
      toast('Senha redefinida para ' + email);
      passInput.value = '';
      await loadUsers();
    }catch(ex){
      console.error(ex);
      showErr((ex && ex.message) || 'Não foi possível redefinir a senha.');
    }finally{
      submitBtn.disabled = false;
      submitBtn.textContent = 'Redefinir senha';
    }
  });
})();
