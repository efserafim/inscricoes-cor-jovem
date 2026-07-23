
  const shell = document.getElementById('shell');
  const menuBtn = document.getElementById('menuBtn');
  const headerActions = document.getElementById('headerActions');
  const themeBtn = document.getElementById('themeBtn');
  const THEME_KEY = 'cor_dash_theme';

  function currentTheme(){
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function syncThemeUi(){
    const dark = currentTheme() === 'dark';
    if(themeBtn){
      themeBtn.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo noturno');
      themeBtn.title = dark ? 'Modo claro' : 'Modo noturno';
    }
  }

  function setTheme(theme){
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try{ localStorage.setItem(THEME_KEY, next); }catch(_){}
    syncThemeUi();
  }

  function toggleTheme(){
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  }

  syncThemeUi();
  if(themeBtn) themeBtn.addEventListener('click', toggleTheme);

  function setMenuOpen(open){
    if(!shell || !menuBtn) return;
    shell.classList.toggle('menu-open', !!open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  }

  if(menuBtn){
    menuBtn.addEventListener('click', ()=>{
      setMenuOpen(!shell.classList.contains('menu-open'));
    });
  }
  if(headerActions){
    headerActions.addEventListener('click', (e)=>{
      if(e.target.closest('a,button')) setMenuOpen(false);
    });
  }
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape') setMenuOpen(false);
  });
