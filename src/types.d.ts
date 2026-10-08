declare module 'markdown-it-task-lists' {
  import type { PluginWithOptions } from 'markdown-it';
  const tasks: PluginWithOptions<{ enabled?: boolean }>;
  export default tasks;
}
