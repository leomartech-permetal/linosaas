/**
 * Next.js Instrumentation — Executado automaticamente ao iniciar o servidor.
 * Registra o cron do Lino Suporte que roda a cada 5 minutos.
 *
 * Zero dependência externa. Zero manutenção.
 * Funciona em Docker, VPS, ou qualquer ambiente onde o Next.js roda como servidor persistente.
 */

export async function register() {
  // Só executa no servidor Node.js (não no Edge Runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] ✅ Servidor iniciado — Registrando Lino Suporte Cron...');

    const INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

    // Aguarda 30s para o servidor estar totalmente pronto
    setTimeout(() => {
      startSupportCron(INTERVAL_MS);
    }, 30_000);
  }
}

async function startSupportCron(intervalMs: number) {
  console.log(`[Lino Suporte Cron] 🚀 Cron iniciado — rodando a cada ${intervalMs / 60000} minutos.`);

  // Executa imediatamente no primeiro ciclo
  await executeCycle();

  // Depois repete a cada intervalo
  setInterval(async () => {
    await executeCycle();
  }, intervalMs);
}

async function executeCycle() {
  try {
    // Removido runSupportMonitor pois o modelo agora é 100% passivo (Ouvidoria).
    // SLA é acionado via Webhook quando o cliente entra em contato na central.
    console.log('[Lino Suporte Cron] ℹ️ Ciclo ignorado: O sistema de suporte agora opera de forma passiva (Ouvidoria).');
  } catch (error) {
    console.error('[Lino Suporte Cron] ❌ Erro no ciclo:', error);
  }
}
