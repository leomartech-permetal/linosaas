-- Correção emergencial: popular product_tag nas skills de produto
-- Skills genéricas (sem product_tag) → carregadas sempre na fase inicial
-- Skills de produto (com product_tag) → carregadas só quando produto for detectado

-- Skills GENÉRICAS (manter product_tag = null)
-- qualificar_lead_comercial, identificar_demanda, fallback_comercial,
-- tratar_pedido_orcamento, rotear_outro_setor, confirmar_dados_e_encaminhar

-- Skills DE PRODUTO (popular product_tag)
UPDATE public.skills SET product_tag = 'chapa perfurada'     WHERE name = 'especificar_chapa_perfurada';
UPDATE public.skills SET product_tag = 'chapa expandida'     WHERE name = 'especificar_chapa_expandida';
UPDATE public.skills SET product_tag = 'chapa recalcada'     WHERE name = 'especificar_chapa_recalcada';
UPDATE public.skills SET product_tag = 'tela expandida'      WHERE name = 'especificar_tela_expandida';
UPDATE public.skills SET product_tag = 'tela antiofuscante'  WHERE name = 'especificar_tela_antiofuscante';
UPDATE public.skills SET product_tag = 'grade de piso'       WHERE name = 'especificar_degrau_grade_piso';
UPDATE public.skills SET product_tag = 'grade de piso'       WHERE name = 'especificar_grade_piso';
UPDATE public.skills SET product_tag = 'piso industrial'     WHERE name = 'especificar_piso_industrial';
UPDATE public.skills SET product_tag = 'gradil'              WHERE name = 'especificar_gradil_metalico';
UPDATE public.skills SET product_tag = 'portao gradil'       WHERE name = 'especificar_portao_gradil';
UPDATE public.skills SET product_tag = 'fachada metalica'    WHERE name = 'especificar_fachada_metalica';
UPDATE public.skills SET product_tag = 'brise metalico'      WHERE name = 'especificar_brise_metalico';
UPDATE public.skills SET product_tag = 'painel perfurado'    WHERE name = 'especificar_painel_perfurado_brise_artemis';
UPDATE public.skills SET product_tag = 'forro metalico'      WHERE name = 'especificar_forro_metalico';
UPDATE public.skills SET product_tag = 'belinox'             WHERE name = 'especificar_bobina_moeda_belinox';
UPDATE public.skills SET product_tag = 'filtro'              WHERE name = 'especificar_filtros_centrifugas';

-- Skills auxiliares de produto → deixar genéricas (null) para sempre carregarem
-- tratar_suporte_andamento, consultar_rag_produto,
-- tratar_cliente_sem_dados_tecnicos, tratar_pedido_urgente,
-- tratar_cliente_envia_arquivo, tratar_produto_fora_catalogo,
-- desempatar_produto_metalico, preparar_payload_roteamento

-- Verificar resultado
SELECT name, product_tag FROM public.skills ORDER BY product_tag NULLS FIRST;
