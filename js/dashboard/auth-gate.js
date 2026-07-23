
  function showGateError(msg){
    gateErr.textContent = msg || 'Não foi possível entrar.';
    gateErr.classList.add('show');
  }

  function openApp(){
    gate.style.display = 'none';
    app.classList.add('open');
    const auth = window.COR_AUTH;
    const name = (auth && auth.userDisplayName()) || '';
    const email = (auth && auth.userEmail()) || '';
    const display = (name && name !== email) ? name : (name || email || 'Equipe');
    const sub = document.getElementById('subtitle');
    const welcome = document.getElementById('welcomeBlock');
    const welcomeName = document.getElementById('welcomeName');
    const welcomeHello = document.getElementById('welcomeHello');
    const avatar = document.getElementById('welcomeAvatar');
    if(sub) sub.textContent = 'Paróquia Santo Antônio — Bacaxá';
    if(welcome && welcomeName){
      welcomeHello.textContent = 'Seja bem-vindo(a),';
      welcomeName.textContent = display;
      if(email) welcome.title = email;
      if(avatar) avatar.textContent = (display.trim().charAt(0) || '?').toUpperCase();
      welcome.hidden = false;
    }
    load();
    if(auth && auth.mustChangePassword()){
      openPasswordModal(true);
    }
  }

  function openPasswordModal(forced){
    const overlay = document.getElementById('pwdOverlay');
    const title = document.getElementById('pwdTitle');
    const hint = document.getElementById('pwdHint');
    const err = document.getElementById('pwdErr');
    err.classList.remove('show');
    document.getElementById('pwdForm').reset();
    overlay.dataset.forced = forced ? '1' : '0';
    if(forced){
      title.textContent = 'Troque a senha de primeiro acesso';
      hint.textContent = 'Por segurança, defina uma senha pessoal agora. A senha de primeiro acesso não deve continuar em uso.';
    }else{
      title.textContent = 'Alterar senha';
      hint.textContent = 'Escolha uma senha nova para o seu acesso ao painel.';
    }
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');
    setTimeout(()=> document.getElementById('pwdNew').focus(), 50);
  }

  function closePasswordModal(){
    const overlay = document.getElementById('pwdOverlay');
    if(overlay.dataset.forced === '1') return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden','true');
  }

  async function bootAuth(){
    if(!window.COR_AUTH){
      showGateError('config.js não carregou.');
      return;
    }
    const ok = await window.COR_AUTH.ensureSession();
    if(ok) openApp();
  }
