import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Global overrides to resolve Electron focus-loss bugs
const originalConfirm = window.confirm;
window.confirm = function (message) {
  const result = originalConfirm(message);
  setTimeout(() => {
    if (window.api && window.api.focusApp) {
      window.api.focusApp();
    }
    window.focus();
    document.body.focus();
  }, 50);
  return result;
};

// Premium custom DOM-based alert to completely avoid buggy native Win32 popup focus loss
window.alert = function (message) {
  const existing = document.getElementById('custom-alert-modal');
  if (existing) {
    existing.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'custom-alert-modal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.zIndex = '999999';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  modal.style.backdropFilter = 'blur(6px)';
  modal.style.animation = 'fadeInAlert 0.15s ease-out';

  if (!document.getElementById('custom-alert-styles')) {
    const style = document.createElement('style');
    style.id = 'custom-alert-styles';
    style.textContent = `
      @keyframes fadeInAlert {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideInAlert {
        from { transform: scale(0.95); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.style.backgroundColor = '#0b0f19';
  card.style.border = '1px solid rgba(59, 130, 246, 0.2)';
  card.style.borderRadius = '1.25rem';
  card.style.padding = '1.5rem 1.75rem';
  card.style.width = '90%';
  card.style.maxWidth = '380px';
  card.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(59, 130, 246, 0.1)';
  card.style.display = 'flex';
  card.style.flexDirection = 'column';
  card.style.gap = '1.25rem';
  card.style.color = '#f1f5f9';
  card.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  card.style.animation = 'slideInAlert 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)';

  const isRTL = document.documentElement.dir === 'rtl';

  const title = document.createElement('h3');
  title.textContent = isRTL ? 'تنبيه النظام' : 'System Notification';
  title.style.margin = '0';
  title.style.fontSize = '0.875rem';
  title.style.fontWeight = '700';
  title.style.color = '#3b82f6';
  title.style.textTransform = 'uppercase';
  title.style.letterSpacing = '0.05em';
  title.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
  title.style.paddingBottom = '0.5rem';
  title.style.textAlign = isRTL ? 'right' : 'left';

  const msgEl = document.createElement('p');
  msgEl.textContent = message;
  msgEl.style.fontSize = '0.8rem';
  msgEl.style.lineHeight = '1.6';
  msgEl.style.margin = '0';
  msgEl.style.color = '#cbd5e1';
  msgEl.style.textAlign = isRTL ? 'right' : 'left';

  const btn = document.createElement('button');
  btn.textContent = isRTL ? 'موافق' : 'OK';
  btn.style.backgroundColor = '#2563eb';
  btn.style.color = '#ffffff';
  btn.style.border = 'none';
  btn.style.borderRadius = '0.75rem';
  btn.style.padding = '0.6rem 2rem';
  btn.style.fontSize = '0.75rem';
  btn.style.fontWeight = '600';
  btn.style.cursor = 'pointer';
  btn.style.alignSelf = 'center';
  btn.style.transition = 'all 0.15s ease';
  btn.style.boxShadow = '0 4px 6px -1px rgba(37, 99, 235, 0.2)';
  
  btn.onmouseover = () => {
    btn.style.backgroundColor = '#1d4ed8';
    btn.style.transform = 'translateY(-1px)';
  };
  btn.onmouseout = () => {
    btn.style.backgroundColor = '#2563eb';
    btn.style.transform = 'translateY(0)';
  };

  btn.onclick = () => {
    modal.remove();
    if (window.api && window.api.focusApp) {
      window.api.focusApp();
    }
    window.focus();
    document.body.focus();
  };

  card.appendChild(title);
  card.appendChild(msgEl);
  card.appendChild(btn);
  modal.appendChild(card);
  document.body.appendChild(modal);

  btn.focus();
};

// Force OS-level refocus on window click to resolve click-through keyboard locks
window.addEventListener('mousedown', () => {
  if (window.api && window.api.focusApp) {
    window.api.focusApp();
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
