// análise de vendas
(() => {
    'use strict';

    const JANELA = 14;          // dias analisados
    const DIA = 864e5;          // milissegundos em um dia
    const arred = (n) => Math.round(n * 100) / 100;

    // datas
    const numeroDoDia = (iso) => {
        const d = new Date(iso);
        return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DIA);
    };
    const textoDoDia = (n) => new Date(n * DIA).toISOString().slice(0, 10);

    // receita por dia
    const receitaPorDia = (pedidos) => {
        const porDia = new Map();
        pedidos.forEach((p) => {
            if (p.status === 'cancelado') return;
            const dia = numeroDoDia(p.data);
            porDia.set(dia, (porDia.get(dia) || 0) + p.total);
        });
        return porDia;
    };

    // linha de tendência
    const retaDeTendencia = (valores) => {
        const n = valores.length;
        const mediaX = (n - 1) / 2;
        const mediaY = valores.reduce((s, y) => s + y, 0) / n;
        let cima = 0, baixo = 0;
        valores.forEach((y, x) => { cima += (x - mediaX) * (y - mediaY); baixo += (x - mediaX) ** 2; });
        const a = cima / baixo;
        return [a, mediaY - a * mediaX];
    };

    // produtos em alta
    const produtosEmAlta = (pedidos, ultimoDia) => {
        const inicioRecente = ultimoDia - (JANELA - 1);
        const inicioAnterior = inicioRecente - JANELA;
        const produtos = new Map();
        pedidos.forEach((p) => {
            if (p.status === 'cancelado') return;
            const dia = numeroDoDia(p.data);
            p.itens.forEach((item) => {
                const v = produtos.get(item.nome) || { recentes: 0, anteriores: 0 };
                if (dia >= inicioRecente) v.recentes += item.qtd;
                else if (dia >= inicioAnterior) v.anteriores += item.qtd;
                produtos.set(item.nome, v);
            });
        });
        const lista = [];
        produtos.forEach((v, nome) => {
            if (v.recentes === 0) return;
            lista.push({
                nome,
                recentes: v.recentes,
                anteriores: v.anteriores,
                variacao: v.recentes - v.anteriores,
                previsao_7d: Math.round(v.recentes / JANELA * 7)
            });
        });
        // ordenação
        lista.sort((a, b) => (b.recentes + b.variacao) - (a.recentes + a.variacao) || b.recentes - a.recentes);
        return lista.slice(0, 6);
    };

    const analisar = (pedidos, diasPrever = 7) => {
        const porDia = receitaPorDia(pedidos);
        if (porDia.size < 3) return { erro: "Poucos dados. Use 'Gerar dados de exemplo' mais abaixo." };

        // dias do período
        const dias = [...porDia.keys()];
        const primeiro = Math.min(...dias), ultimo = Math.max(...dias);
        const valores = [];
        for (let d = primeiro; d <= ultimo; d++) valores.push(porDia.get(d) || 0);

        // previsão
        const [a, b] = retaDeTendencia(valores);
        const previsao = [];
        for (let i = 1; i <= diasPrever; i++) {
            const y = Math.max(0, a * (valores.length - 1 + i) + b);
            previsao.push({ data: textoDoDia(ultimo + i), valor: arred(y) });
        }

        const faturamento = valores.reduce((s, v) => s + v, 0);
        const qtdPedidos = pedidos.filter((p) => p.status !== 'cancelado').length;
        return {
            faturamento: arred(faturamento),
            pedidos: qtdPedidos,
            ticket_medio: arred(faturamento / qtdPedidos),
            tendencia: a > 0 ? 'subindo' : 'caindo',
            real: valores.map((v, i) => ({ data: textoDoDia(primeiro + i), valor: arred(v) })),
            previsao,
            total_previsto: arred(previsao.reduce((s, x) => s + x.valor, 0)),
            produtos: produtosEmAlta(pedidos, ultimo)
        };
    };

    window.Analise = { analisar };
})();
