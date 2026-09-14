export {};

declare global {
  interface Window {
    webkit?: {
      messageHandlers: {
        ribbit: {
          postMessage: (m: unknown) => void;
        };
      };
    };
    ribbit?: {
      receive: (m: unknown) => void;
    };
  }
}
