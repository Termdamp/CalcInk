const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('#app element missing from index.html');

app.textContent = 'CalcInk: Phase 0';