const { ipcRenderer } = require('electron');

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
    pointerEvents: 'auto',
    userSelect: 'none',
    WebkitAppRegion: 'no-drag',
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
      cursor: 'pointer',
      pointerEvents: 'auto',
      touchAction: 'manipulation',
      boxShadow: '0 0 0 1px rgba(0,0,0,0.12) inset',
      WebkitAppRegion: 'no-drag',
    });

    const handleWindowAction = (event) => {
      event.preventDefault();
      event.stopPropagation();
      ipcRenderer.send('auth-window-action', action);
    };

    btn.addEventListener('click', handleWindowAction);
    btn.addEventListener('pointerdown', (event) => event.stopPropagation());
    btn.addEventListener('mousedown', (event) => event.stopPropagation());
    btn.addEventListener('touchstart', (event) => event.stopPropagation(), { passive: true });
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

const attachOverlays = () => {
  const body = document.body || document.documentElement;
  if (!body) return;

  if (!document.getElementById('comet-auth-drag')) {
    body.appendChild(createDragOverlay());
  }

  if (!document.getElementById('comet-auth-traffic')) {
    const traffic = createTrafficLights();
    body.appendChild(traffic);
  }
};

const observeDom = () => {
  const target = document.body || document.documentElement;
  if (!target) return;
  const observer = new MutationObserver(() => attachOverlays());
  observer.observe(target, { childList: true, subtree: true });
};

window.addEventListener('DOMContentLoaded', () => {
  attachOverlays();
  observeDom();

  window.addEventListener('keyup', (event) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      ipcRenderer.send('auth-window-action', 'close');
    }
  });

  document.addEventListener('click', (event) => {
    if (event.target && event.target.dataset && event.target.dataset.action === 'close') {
      ipcRenderer.send('auth-window-action', 'close');
    }
  });
});
