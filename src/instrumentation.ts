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
    // Importação dinâmica para evitar problemas de import no edge runtime
    const { runSupportMonitor } = await import('./lib/support-monitor');

    const startTime = Date.now();
    const result = await runSupportMonitor();
    const elapsed = Date.now() - startTime;

    console.log(`[Lino Suporte Cron] ✅ Ciclo completo em ${elapsed}ms — ` +
      `Verificados: ${result.checked} | Notificados: ${result.notified} | ` +
      `Escalados: ${result.escalated} | Resolvidos: ${result.resolved}` +
      (result.errors.length > 0 ? ` | Erros: ${result.errors.length}` : ''));
  } catch (error) {
    console.error('[Lino Suporte Cron] ❌ Erro no ciclo:', error);
  }
}
