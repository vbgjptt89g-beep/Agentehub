let sql;
let schemaReady;

function database() {
  if (!process.env.DATABASE_URL) {
    const error = new Error('La base de datos no está configurada. Añade DATABASE_URL en el entorno.');
    error.status = 503;
    error.code = 'DATABASE_NOT_CONFIGURED';
    throw error;
  }
  if (!sql) {
    const { neon } = require('@neondatabase/serverless');
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

async function ensureTaskSchema() {
  if (!schemaReady) {
    schemaReady = database()`
      CREATE TABLE IF NOT EXISTS agent_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id BIGINT NOT NULL,
        user_login TEXT NOT NULL,
        repository TEXT NOT NULL,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        model TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued'
          CHECK (status IN ('queued', 'running', 'paused', 'completed', 'failed', 'cancelled')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `.then(() => database()`
      ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS issue_number INTEGER
    `.then(() => database()`
      CREATE INDEX IF NOT EXISTS agent_tasks_user_created_idx
      ON agent_tasks (user_id, created_at DESC)
    `)).catch(error => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

module.exports = { database, ensureTaskSchema };
