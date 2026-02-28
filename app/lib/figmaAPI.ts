// Helper for iframe ↔ plugin communication

type MessageHandler = (msg: any) => void;

let messageHandlers: Map<string, MessageHandler[]> = new Map();
let pluginIdCache: string | null | undefined;

function getPluginId(): string {
  if (pluginIdCache !== undefined) {
    return pluginIdCache || '*';
  }
  if (typeof window === 'undefined') {
    pluginIdCache = '*';
    return pluginIdCache;
  }
  const params = new URLSearchParams(window.location.search);
  pluginIdCache = params.get('pluginId');
  return pluginIdCache || '*';
}

// Listen for messages from the Figma plugin sandbox
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    // Handle theme messages from ui.html wrapper
    if (event.data?.figmaTheme) {
      applyTheme(event.data.figmaTheme);
      return;
    }

    const msg = event.data?.pluginMessage;
    if (!msg || !msg.type) return;

    const handlers = messageHandlers.get(msg.type);
    if (handlers) {
      handlers.forEach((handler) => handler(msg));
    }

    // Also notify wildcard listeners
    const wildcardHandlers = messageHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => handler(msg));
    }
  });
}

function applyTheme(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function onPluginMessage(type: string, handler: MessageHandler) {
  if (!messageHandlers.has(type)) {
    messageHandlers.set(type, []);
  }
  messageHandlers.get(type)!.push(handler);

  // Return cleanup function
  return () => {
    const handlers = messageHandlers.get(type);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    }
  };
}

export function sendToPlugin(message: any) {
  if (typeof parent !== 'undefined') {
    parent.postMessage(
      { pluginMessage: message, pluginId: getPluginId() },
      '*'
    );
  }
}
