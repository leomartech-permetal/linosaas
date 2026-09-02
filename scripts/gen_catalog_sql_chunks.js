const fs = require('fs');
const path = require('path');

const JSONL = path.resolve(__dirname, '../../lino_knowledge_package_v3/lino_knowledge_package_v3/catalog/published_variants.jsonl');
const OUTDIR = path.resolve(__dirname, '../database');

const lines = fs.readFileSync(JSONL, 'utf8').split('\n').filter(l => l.trim());

const rows = [];
for (const line of lines) {
  try {
    const r = JSON.parse(line);
    if (r.approval_status !== 'APPROVED' || r.active_for_lino === false) continue;
    const attrs = JSON.stringify(r.technical_attributes || {}).replace(/'/g, "''");
    const sf  = (r.source && r.source.file ? r.source.file : '').replace(/'/g, "''");
    const sl  = (r.source && r.source.line) ? r.source.line : 'NULL';
    const vid = (r.variant_id || '').replace(/'/g, "''");
    const ts  = (r.tenant_slug || '').replace(/'/g, "''");
    const bs  = (r.brand_slug || '').replace(/'/g, "''");
    const fs2 = (r.family_slug || '').replace(/'/g, "''");
    const ps  = (r.product_slug || '').replace(/'/g, "''");
    const cs  = (r.category_slug || '').replace(/'/g, "''");
    rows.push(
      "(v_tenant_id,'3.0.0','technical_variant','" + vid + "','" + ts + "','" + bs + "','" + fs2 + "','" + ps + "','" + cs + "','APPROVED',TRUE,'" + attrs + "'::jsonb,'" + sf + "'," + sl + ",TRUE)"
    );
  } catch(e) {}
}

const CHUNK = 490; // ~490 linhas por arquivo (~200KB cada)
const total = rows.length;
const numFiles = Math.ceil(total / CHUNK);

for (let i = 0; i < numFiles; i++) {
  const chunk = rows.slice(i * CHUNK, (i + 1) * CHUNK);
  const parte = i + 1;

  let sql = '-- ============================================================\n';
  sql += '-- IMPORT CATÁLOGO v3 — PARTE ' + parte + '/' + numFiles + ' (' + chunk.length + ' variantes)\n';
  sql += '-- Cole no Supabase SQL Editor\n';
  sql += '-- ============================================================\n';
  sql += 'DO $$\n';
  sql += 'DECLARE v_tenant_id UUID;\n';
  sql += 'BEGIN\n';
  sql += '  SELECT id INTO v_tenant_id FROM public.tenants LIMIT 1;\n';
  sql += '  IF v_tenant_id IS NULL THEN\n';
  sql += "    RAISE EXCEPTION 'Nenhum tenant encontrado.';\n";
  sql += '  END IF;\n\n';
  sql += '  INSERT INTO public.catalog_variants_v3\n';
  sql += '    (tenant_id, schema_version, record_kind, variant_id, tenant_slug, brand_slug, family_slug, product_slug, category_slug, approval_status, active_for_lino, technical_attributes, source_file, source_line, commercial_data_excluded)\n';
  sql += '  VALUES\n';
  sql += chunk.join(',\n') + '\n';
  sql += '  ON CONFLICT (tenant_id, variant_id) DO UPDATE SET\n';
  sql += '    technical_attributes = EXCLUDED.technical_attributes,\n';
  sql += '    updated_at = NOW();\n\n';
  sql += "  RAISE NOTICE 'Parte " + parte + "/" + numFiles + " OK — " + chunk.length + " variantes inseridas.';\n";
  sql += 'END $$;\n';

  const fname = path.join(OUTDIR, 'import_catalog_v3_parte' + parte + '.sql');
  fs.writeFileSync(fname, sql, 'utf8');
  console.log('Gerado: import_catalog_v3_parte' + parte + '.sql (' + chunk.length + ' variantes, ' + Math.round(sql.length/1024) + 'KB)');
}

console.log('\nTotal: ' + total + ' variantes em ' + numFiles + ' arquivos.');
console.log('Execute no Supabase SQL Editor na ordem: parte1 → parte2 → ... → parte' + numFiles);
