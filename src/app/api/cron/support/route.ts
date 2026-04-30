import { NextResponse } from 'next/server';
import { runSupportMonitor } from '@/lib/support-monitor';

/**
 * GET /api/cron/support
 *
 * Endpoint para executar manualmente o ciclo do Lino Suporte.
 * Também serve como health-check do monitoramento.
 *
 * Pode ser chamado:
 * - Pelo cron interno (instrumentation.ts)
 * - Por n8n ou cron externo
 * - Manualmente para debug
 */
export async function GET(request: Request) {
  try {
    // Proteção básica: só aceitar com header ou query secret
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const headerSecret = request.headers.get('x-cron-secret');

    const expectedSecret = process.env.CRON_SECRET || 'lino-suporte-2026';

    if (secret !== expectedSecret && headerSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Iniciando ciclo do Lino Suporte...');
    const startTime = Date.now();

    const result = await runSupportMonitor();

    const elapsed = Date.now() - startTime;

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      elapsed_ms: elapsed,
      result,
    });
  } catch (error: any) {
    console.error('[Cron Error]', error);
    return NextResponse.json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
