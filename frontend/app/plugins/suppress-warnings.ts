export default defineNuxtPlugin(() => {
  if (process.dev) {
    const originalWarn = console.warn;
    console.warn = (...args) => {
      if (args[0]?.includes('No match found for location with path')) {
        return;
      }
      originalWarn.apply(console, args);
    };
  }
}); 