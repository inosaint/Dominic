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
