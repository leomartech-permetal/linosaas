import { supabase } from './supabase';

/**
 * LINO DEBUGGER — Central de Logs e Diagnósticos
 */

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export async function logDebug(params: {
  level?: LogLevel;
  module: string;
  action: string;
  leadId?: string;
  details?: any;
}) {
  const { level = 'INFO', module, action, leadId, details } = params;
  
  console.log(`[DEBUG] [${module}] ${action}${leadId ? ` (Lead: ${leadId})` : ''}`, details || '');

  try {
    await supabase.from('debug_logs').insert([{
      level,
      module,
      action,
      lead_id: leadId,
      details: details || {}
    }]);
  } catch (err) {
    console.error('[Debugger] Erro ao salvar log no banco:', err);
  }
}

export async function getRecentLogs(limit = 100) {
  const { data, error } = await supabase
    .from('debug_logs')
    .select('*, leads(name, whatsapp_number)')
    .order('created_at', { ascending: false })
    .limit(limit);
    
  return { data, error };
}

export async function clearOldLogs(days = 7) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  
  const { error } = await supabase
    .from('debug_logs')
    .delete()
    .lt('created_at', date.toISOString());
    
  return { error };
}
