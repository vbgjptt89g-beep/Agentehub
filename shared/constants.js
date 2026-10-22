'use strict';

const SUPPORTED_MODELS = Object.freeze([
  'Claude Sonnet 4',
  'Codex · GPT-5',
  'Comparar ambos'
]);

const TASK_STATUS = Object.freeze({
  QUEUED: 'queued',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
});

module.exports = { SUPPORTED_MODELS, TASK_STATUS };

