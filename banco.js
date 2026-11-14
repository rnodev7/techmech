// banco de dados
(() => {
    'use strict';

    const CFG = window.TECHMECH || {};
    const configurado = () => !!(CFG.supabaseUrl && CFG.supabaseChave && !CFG.supabaseUrl.includes('COLE-AQUI'));
    const urlPedidos = () => CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/pedidos';
    const urlProdutos = () => CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/produtos';

    // cabeçalhos
    const cabecalho = (token, extra = {}) => {
        const h = { apikey: CFG.supabaseChave, 'Content-Type': 'application/json', ...extra };
        if (token) h.Authorization = 'Bearer ' + token;
        return h;
    };

    // conversão de campos
    const paraLinha = (p) => ({
        numero: p.numero, data: p.data, status: p.status, itens: p.itens,
        subtotal: p.subtotal, cupom: p.cupom || null,
        desc_cupom: p.descCupom || 0, desc_pagamento: p.descPagamento || 0,
        frete: p.frete || 0, frete_tipo: p.freteTipo,
        pagamento: p.pagamento, parcelas: p.parcelas || 1, juros: !!p.juros,
        total: p.total, demo: !!p.demo
    });
    const paraPedido = (r) => ({
        numero: r.numero, data: r.data, status: r.status, itens: r.itens,
        subtotal: Number(r.subtotal), cupom: r.cupom,
        descCupom: Number(r.desc_cupom), descPagamento: Number(r.desc_pagamento),
        frete: Number(r.frete), freteTipo: r.frete_tipo,
        pagamento: r.pagamento, parcelas: r.parcelas, juros: r.juros,
        total: Number(r.total), demo: r.demo
    });

    const resposta = (corpo, status = 200) =>
        new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
    const erroDe = async (r) => {
        const d = await r.json().catch(() => null);
        return resposta({ erro: (d && (d.message || d.msg)) || 'Erro no banco de dados' }, r.status);
    };

    window.Banco = {
        configurado,

        // criar pedido
        async criarPedido(pedido) {
            if (!configurado()) throw new Error('config.js ainda não foi preenchido');
            return fetch(urlPedidos(), {
                method: 'POST',
                headers: cabecalho(null, { Prefer: 'return=minimal' }),
                body: JSON.stringify(paraLinha(pedido)),
                keepalive: true
            });
        },

        // produtos da loja (leitura pública, só os ativos)
        async listarProdutos() {
            if (!configurado()) return [];
            const r = await fetch(urlProdutos() + '?select=*&ativo=eq.true&order=criado_em.asc&limit=1000', { headers: cabecalho(null), cache: 'no-store' });
            if (!r.ok) throw new Error('erro ' + r.status);
            return r.json();
        },

        // envia a imagem de um produto para o Storage e devolve o link público
        async enviarImagem(arquivo) {
            if (!configurado()) throw new Error('config.js ainda não foi preenchido');
            const token = window.Auth && Auth.token();
            if (!token) throw new Error('Não autenticado');
            if (!/^image\//.test(arquivo.type)) throw new Error('O arquivo precisa ser uma imagem');
            if (arquivo.size > 5 * 1024 * 1024) throw new Error('A imagem passa de 5 MB');
            const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
            const nome = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
            const base = CFG.supabaseUrl.replace(/\/$/, '') + '/storage/v1/object/';
            const r = await fetch(base + 'produtos/' + nome, {
                method: 'POST',
                headers: { apikey: CFG.supabaseChave, Authorization: 'Bearer ' + token, 'Content-Type': arquivo.type, 'x-upsert': 'false' },
                body: arquivo
            });
            if (!r.ok) {
                const d = await r.json().catch(() => null);
                throw new Error((d && (d.message || d.error)) || 'Erro ao enviar a imagem (rodou o supabase_produtos.sql?)');
            }
            return base + 'public/produtos/' + nome;
        },

        // painel admin
        async admin(url, opc = {}) {
            if (!configurado()) return resposta({ erro: 'config.js ainda não foi preenchido' }, 500);
            const token = window.Auth && Auth.token();
            if (!token) return resposta({ erro: 'Não autenticado' }, 401);

            const [caminho, consulta = ''] = url.replace(/^\/api\//, '').split('?');
            const partes = caminho.split('/').map(decodeURIComponent);
            const metodo = (opc.method || 'GET').toUpperCase();
            const corpo = opc.body ? JSON.parse(opc.body) : null;
            const h = (extra) => cabecalho(token, extra);
            let r;

            // listar pedidos
            if (partes.length === 1 && partes[0] === 'pedidos' && metodo === 'GET') {
                r = await fetch(urlPedidos() + '?select=*&order=data.desc&limit=5000', { headers: h(), cache: 'no-store' });
                return r.ok ? resposta((await r.json()).map(paraPedido)) : erroDe(r);
            }
            // apagar pedidos
            if (partes.length === 1 && partes[0] === 'pedidos' && metodo === 'DELETE') {
                const filtro = consulta.includes('demo=1') ? 'demo=eq.true' : 'numero=not.is.null';
                r = await fetch(urlPedidos() + '?' + filtro, { method: 'DELETE', headers: h() });
                return r.ok ? resposta({ ok: true }) : erroDe(r);
            }
            // dados de exemplo
            if (partes[0] === 'pedidos' && partes[1] === 'importar' && metodo === 'POST') {
                r = await fetch(urlPedidos(), {
                    method: 'POST',
                    headers: h({ Prefer: 'resolution=ignore-duplicates,return=minimal' }),
                    body: JSON.stringify(corpo.map(paraLinha))
                });
                return r.ok ? resposta({ gravados: corpo.length }, 201) : erroDe(r);
            }
            // status e exclusão
            if (partes.length === 2 && partes[0] === 'pedidos' && (metodo === 'PATCH' || metodo === 'DELETE')) {
                r = await fetch(urlPedidos() + '?numero=eq.' + encodeURIComponent(partes[1]), {
                    method: metodo,
                    headers: h({ Prefer: 'return=representation' }),
                    body: metodo === 'PATCH' ? JSON.stringify({ status: corpo.status }) : undefined
                });
                if (!r.ok) return erroDe(r);
                const afetados = await r.json().catch(() => []);
                return afetados.length ? resposta({ ok: true }) : resposta({ erro: 'Pedido não encontrado' }, 404);
            }
            // produtos
            if (partes[0] === 'produtos') {
                if (partes.length === 1 && metodo === 'GET') {
                    r = await fetch(urlProdutos() + '?select=*&order=criado_em.desc&limit=1000', { headers: h(), cache: 'no-store' });
                    return r.ok ? resposta(await r.json()) : erroDe(r);
                }
                if (partes.length === 1 && metodo === 'POST') {
                    r = await fetch(urlProdutos(), { method: 'POST', headers: h({ Prefer: 'return=representation' }), body: JSON.stringify(corpo) });
                    return r.ok ? resposta((await r.json())[0] || { ok: true }, 201) : erroDe(r);
                }
                if (partes.length === 2 && (metodo === 'PATCH' || metodo === 'DELETE')) {
                    r = await fetch(urlProdutos() + '?id=eq.' + encodeURIComponent(partes[1]), {
                        method: metodo,
                        headers: h({ Prefer: 'return=representation' }),
                        body: metodo === 'PATCH' ? JSON.stringify(corpo) : undefined
                    });
                    if (!r.ok) return erroDe(r);
                    const afetados = await r.json().catch(() => []);
                    return afetados.length ? resposta({ ok: true }) : resposta({ erro: 'Produto não encontrado' }, 404);
                }
            }
            return resposta({ erro: 'Rota não encontrada' }, 404);
        }
    };
})();