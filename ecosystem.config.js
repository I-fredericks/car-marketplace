// PM2 process definition for a single-server deploy (backend serving the
// built frontend from ../../frontend/dist, which Express picks up when present).
module.exports = {
  apps: [
    {
      name: 'carmarket-api',
      cwd: './backend',
      script: 'src/index.js',
      instances: 'max', // cluster across all cores; SSE + in-memory event bus
      // NOTE: the SSE event bus is per-process. With instances > 1, messages
      // and notifications only reach users connected to the same worker.
      // Keep instances: 1 until the event bus moves to Redis pub/sub.
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
      // Graceful shutdown: PM2 sends SIGTERM and waits kill_timeout before SIGKILL
      kill_timeout: 8000,
      wait_ready: false,
      out_file: './logs/api-out.log',
      error_file: './logs/api-err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
