import './styles/themes.css';
import './styles/global.css';
import './styles/markdown.css';
import { startApp } from './app';

void startApp(document.querySelector<HTMLDivElement>('#app')!).catch(
  (error) => {
    document.querySelector<HTMLDivElement>('#app')!.textContent =
      `Mivu could not start: ${String(error)}`;
  },
);
