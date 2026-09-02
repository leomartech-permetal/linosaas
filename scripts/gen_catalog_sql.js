const fs = require('fs');
const path = require('path');

const JSONL = path.resolve(__dirname, '../../lino_knowledge_package_v3/lino_knowledge_package_v3/catalog/published_variants.jsonl');
const OUT   = path.resolve(__dirname, '../database/import_catalog_v3_data.sql');

const lines = fs.readFileSync(JSONL, 'utf8').split('\n').filter(l => l.trim());

const rows = [];
for (const line of lines) {
  try {
    const r = JSON.parse(line);
    if (r.approval_status !== 'APPROVED' || r.active_for_lino === false) continue;
    const attrs = JSON.stringify(r.technical_attributes || {}).replace(/'/g, "''");
    const sf    = (r.source && r.source.file ? r.source.file : '').replace(/'/g, "''");
    const sl    = (r.source && r.source.line) ? r.source.line : 'NULL';
    const vid   = (r.variant_id || '').replace(/'/g, "''");
    const ts    = (r.tenant_slug || '').replace(/'/g, "''");
    const bs    = (r.brand_slug || '').replace(/'/g, "''");
    const fs2   = (r.family_slug || '').replace(/'/g, "''");
    const ps    = (r.product_slug || '').replace(/'/g, "''");
    const cs    = (r.category_slug || '').replace(/'/g, "''");
    rows.push(
      "(v_tenant_id,'3.0.0','technical_variant','" + vid + "','" + ts + "','" + bs + "','" + fs2 + "','" + ps + "','" + cs + "','APPROVED',TRUE,'" + attrs + "'::jsonb,'" + sf + "'," + sl + ",TRUE)"
    );
  } catch(e) {
    // linha inválida — ignorar
  }
}

let sql = '-- ============================================================\n';
sql += '-- IMPORT CATÁLOGO v3 — Cole no Supabase SQL Editor\n';
sql += '-- ============================================================\n';
sql += 'DO $$\n';
sql += 'DECLARE v_tenant_id UUID;\n';
sql += 'BEGIN\n';
sql += '  SELECT id INTO v_tenant_id FROM public.tenants LIMIT 1;\n\n';
sql += '  IF v_tenant_id IS NULL THEN\n';
sql += "    RAISE EXCEPTION 'Nenhum tenant encontrado. Crie o tenant antes de importar.';\n";
sql += '  END IF;\n\n';
sql += '  INSERT INTO public.catalog_variants_v3\n';
sql += '    (tenant_id, schema_version, record_kind, variant_id, tenant_slug, brand_slug, family_slug, product_slug, category_slug, approval_status, active_for_lino, technical_attributes, source_file, source_line, commercial_data_excluded)\n';
sql += '  VALUES\n';
sql += rows.join(',\n') + '\n';
sql += '  ON CONFLICT (tenant_id, variant_id) DO UPDATE SET\n';
sql += '    technical_attributes = EXCLUDED.technical_attributes,\n';
sql += '    brand_slug = EXCLUDED.brand_slug,\n';
sql += '    product_slug = EXCLUDED.product_slug,\n';
sql += '    updated_at = NOW();\n\n';
sql += '  RAISE NOTICE \'Importadas % variantes.\', ' + rows.length + ';\n';
sql += 'END $$;\n';

fs.writeFileSync(OUT, sql, 'utf8');
console.log('OK — ' + rows.length + ' variantes -> database/import_catalog_v3_data.sql');
