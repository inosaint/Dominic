import React from 'react';
import { createRoot } from 'react-dom/client';
import Home from './page';

// --- Theme detection for Figma plugin environment ---
// Figma injects --figma-color-bg when themeColors: true.
// We detect light vs dark and toggle the 'dark' class for Tailwind.
function detectTheme(): 'light' | 'dark' {
  const bg = getComputedStyle(document.documentElement)
    .getPropertyValue('--figma-color-bg')
    .trim();
  if (!bg) return 'dark';
  let r = 0,
    g = 0,
    b = 0;
  const rgbMatch = bg.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/);
  if (rgbMatch) {
    r = parseInt(rgbMatch[1]);
    g = parseInt(rgbMatch[2]);
    b = parseInt(rgbMatch[3]);
  } else if (bg.charAt(0) === '#') {
    let hex = bg.slice(1);
    if (hex.length === 3)
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  }
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? 'light' : 'dark';
}

function applyTheme() {
  const theme = detectTheme();
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Apply theme on load
applyTheme();

// Re-apply when Figma changes the theme (updates style attribute on <html>)
const observer = new MutationObserver(applyTheme);
observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['style'],
});

// Render the app
const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <Home />
    </React.StrictMode>
  );
}
