/// <reference types="vite/client" />

declare module "@kuzu/kuzu-wasm" {
  const init: () => Promise<{
    Database: () => Promise<unknown>;
    Connection: (db: unknown) => Promise<unknown>;
  }>;
  export default init;
}
