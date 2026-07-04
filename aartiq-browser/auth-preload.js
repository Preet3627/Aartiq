const { ipcRenderer } = require('electron');

const createAuthTitle = () => {
  const title = document.createElement('div');
  title.id = 'comet-auth-title';
  title.textContent = 'Sign in to Aartiq';
  Object.assign(title.style, {
    position: 'fixed',
    top: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '13px',
    fontWeight: '600',
    color: '#ffffff',
    zIndex: '10000000',
    pointerEvents: 'none',
    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
  });
  return title;
};

const createTrafficLights = () => {
  const wrapper = document.createElement('div');
  wrapper.id = 'comet-auth-traffic';
  Object.assign(wrapper.style, {
    position: 'fixed',
    top: '10px',
    left: '18px',
    display: 'flex',
    gap: '6px',
    zIndex: '10000000',
    pointerEvents: 'none',
  });

  const colors = [
    { color: '#ff605c', action: 'close' },
    { color: '#ffbd44', action: 'minimize' },
    { color: '#00ca4e', action: 'zoom' },
  ];

  colors.forEach(({ color, action }) => {
    const btn = document.createElement('button');
    btn.className = 'comet-traffic-light';
    btn.dataset.action = action;
    btn.title = action.charAt(0).toUpperCase() + action.slice(1);
    Object.assign(btn.style, {
      width: '12px',
      height: '12px',
      borderRadius: '999px',
      border: 'none',
      background: color,
      outline: 'none',
      cursor: action === 'close' ? 'pointer' : 'default',
      pointerEvents: action === 'close' ? 'auto' : 'none',
      boxShadow: '0 0 0 1px rgba(0,0,0,0.12) inset',
    });
    wrapper.appendChild(btn);
  });

  return wrapper;
};

const createDragOverlay = () => {
  const overlay = document.createElement('div');
  overlay.id = 'comet-auth-drag';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    height: '44px',
    WebkitAppRegion: 'drag',
    pointerEvents: 'none',
    background: 'linear-gradient(180deg, rgba(5,5,10,0.8), transparent)',
    zIndex: '9999999',
  });
  return overlay;
};

  window.addEventListener('DOMContentLoaded', () => {
    const body = document.body || document.documentElement;
    if (!body) return;

    if (!document.getElementById('comet-auth-drag')) {
      body.appendChild(createDragOverlay());
    }

    if (!document.getElementById('comet-auth-traffic')) {
      // Only show custom traffic lights if we don't have native ones (not macOS and not Windows with overlay)
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isWin = navigator.platform.toUpperCase().indexOf('WIN') >= 0;
      
      if (!isMac && !isWin) {
        const traffic = createTrafficLights();
        body.appendChild(traffic);
      }
    }

    if (!document.getElementById('comet-auth-title')) {
      body.appendChild(createAuthTitle());
    }

    if (!document.getElementById('comet-auth-close-btn')) {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isWin = navigator.platform.toUpperCase().indexOf('WIN') >= 0;

      // Only show manual button if native ones are likely missing or preferred for simplicity
      // But avoid showing it if it would overlap with Win/Mac native controls we just fixed
      if (!isWin && !isMac) {
        const closeBtn = document.createElement('div');
        closeBtn.id = 'comet-auth-close-btn';
        closeBtn.innerHTML = '✕';
        closeBtn.title = 'Close Window';
        Object.assign(closeBtn.style, {
          position: 'fixed',
          top: '12px',
          right: '18px',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '6px',
          cursor: 'pointer',
          zIndex: '10000001',
          WebkitAppRegion: 'no-drag',
          color: '#ffffff',
          fontSize: '14px',
          transition: 'all 0.2s ease',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        });
        closeBtn.onmouseenter = () => closeBtn.style.background = 'rgba(255, 0, 0, 0.2)';
        closeBtn.onmouseleave = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.05)';
        closeBtn.onclick = () => ipcRenderer.send('close-auth-window');
        body.appendChild(closeBtn);
      }
    }

  window.addEventListener('keyup', (event) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      ipcRenderer.send('close-auth-window');
    }
  });

  document.addEventListener('click', (event) => {
    if (event.target && event.target.dataset && event.target.dataset.action === 'close') {
      ipcRenderer.send('close-auth-window');
    }
  });
});
