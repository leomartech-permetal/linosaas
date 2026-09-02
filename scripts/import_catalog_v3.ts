/**
 * SCRIPT DE IMPORTAÇÃO DO CATÁLOGO v3
 *
 * Lê o arquivo published_variants.jsonl (2451 variantes) e faz upsert em
 * lotes de 100 na tabela catalog_variants_v3.
 *
 * IDEMPOTENTE: pode ser executado múltiplas vezes sem duplicação.
 * ON CONFLICT (tenant_id, variant_id) → atualiza os atributos.
 *
 * Uso:
 *   cd lino-crm
 *   npx tsx scripts/import_catalog_v3.ts
 *
 * Requer:
 *   - SUPABASE_SERVICE_ROLE_KEY no ambiente
 *   - NEXT_PUBLIC_SUPABASE_URL no ambiente
 *   - Tabela catalog_variants_v3 criada (migration 003)
 */

import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// ─── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────

// Carregar .env.local automaticamente se não estiver no ambiente
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.trim().match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Caminho do arquivo JSONL (relativo ao lino-crm/)
const CATALOG_FILE = path.resolve(
  __dirname,
  '../../lino_knowledge_package_v3/lino_knowledge_package_v3/catalog/published_variants.jsonl'
);

const BATCH_SIZE = 100;
const TENANT_SLUG = 'grupo_permetal';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function getTenantId(): Promise<string> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name')
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Erro ao buscar tenant: ${error.message}`);
  if (!data) {
    const { data: newTenant, error: insertErr } = await supabase
      .from('tenants')
      .insert([{ name: 'Permetal' }])
      .select()
      .single();
    if (insertErr) throw new Error(`Erro ao criar tenant: ${insertErr.message}`);
    console.log(`✅ Tenant criado: ${newTenant.id}`);
    return newTenant.id;
  }
  console.log(`✅ Tenant encontrado: ${data.name} (${data.id})`);
  return data.id;
}

function mapVariantToRow(record: any, tenantId: string): Record<string, any> {
  return {
    tenant_id: tenantId,
    schema_version: record.schema_version || '3.0.0',
    record_kind: record.record_kind || 'technical_variant',
    variant_id: record.variant_id,
    tenant_slug: record.tenant_slug,
    brand_slug: record.brand_slug,
    family_slug: record.family_slug,
    product_slug: record.product_slug,
    category_slug: record.category_slug,
    approval_status: record.approval_status || 'APPROVED',
    active_for_lino: record.active_for_lino !== false,
    technical_attributes: record.technical_attributes || {},
    source_file: record.source?.file || null,
    source_line: record.source?.line || null,
    commercial_data_excluded: record.commercial_data_excluded !== false,
    imported_at: new Date().toISOString(),
  };
}

async function upsertBatch(rows: Record<string, any>[]): Promise<void> {
  const { error } = await supabase
    .from('catalog_variants_v3')
    .upsert(rows, {
      onConflict: 'tenant_id,variant_id',
      ignoreDuplicates: false,   // atualizar se mudou
    });

  if (error) {
    throw new Error(`Erro no upsert: ${error.message}`);
  }
}

// ─── PROCESSAMENTO PRINCIPAL ──────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 IMPORTAÇÃO CATÁLOGO v3 — Grupo Permetal');
  console.log('='.repeat(50));

  if (!fs.existsSync(CATALOG_FILE)) {
    console.error(`❌ Arquivo não encontrado: ${CATALOG_FILE}`);
    process.exit(1);
  }

  console.log(`📂 Arquivo: ${CATALOG_FILE}`);

  const tenantId = await getTenantId();
  console.log(`🏢 Tenant ID: ${tenantId}`);

  const rl = readline.createInterface({
    input: fs.createReadStream(CATALOG_FILE, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let batch: Record<string, any>[] = [];
  let totalProcessed = 0;
  let totalErrors = 0;
  let batchIndex = 0;
  let skipped = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let record: any;
    try {
      record = JSON.parse(trimmed);
    } catch {
      console.warn(`⚠️  Linha inválida (JSON parse): ${trimmed.substring(0, 80)}...`);
      skipped++;
      continue;
    }

    // Filtrar apenas variantes aprovadas e ativas
    if (record.approval_status !== 'APPROVED' || record.active_for_lino === false) {
      skipped++;
      continue;
    }

    batch.push(mapVariantToRow(record, tenantId));

    if (batch.length >= BATCH_SIZE) {
      batchIndex++;
      process.stdout.write(`  Lote ${batchIndex} (${batch.length} variantes)... `);
      try {
        await upsertBatch(batch);
        totalProcessed += batch.length;
        console.log(`✅ ok (${totalProcessed} total)`);
      } catch (err: any) {
        totalErrors += batch.length;
        console.error(`❌ ${err.message}`);
      }
      batch = [];
    }
  }

  // Último lote parcial
  if (batch.length > 0) {
    batchIndex++;
    process.stdout.write(`  Lote ${batchIndex} (${batch.length} variantes)... `);
    try {
      await upsertBatch(batch);
      totalProcessed += batch.length;
      console.log(`✅ ok (${totalProcessed} total)`);
    } catch (err: any) {
      totalErrors += batch.length;
      console.error(`❌ ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Resumo:`);
  console.log(`   ✅ Importadas: ${totalProcessed}`);
  console.log(`   ⏭️  Ignoradas:  ${skipped}`);
  console.log(`   ❌ Erros:      ${totalErrors}`);
  console.log('='.repeat(50) + '\n');

  if (totalErrors > 0) {
    console.error('⚠️  Importação concluída com erros. Verifique os logs acima.');
    process.exit(1);
  }

  console.log('🎉 Importação concluída com sucesso!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
