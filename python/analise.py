# análise de vendas
from datetime import datetime, timedelta

JANELA = 14


# receita por dia
def receita_por_dia(pedidos):
    por_dia = {}
    for p in pedidos:
        if p["status"] == "cancelado":
            continue
        dia = datetime.fromisoformat(p["data"]).date()
        por_dia[dia] = por_dia.get(dia, 0) + p["total"]
    return por_dia


# linha de tendência
def reta_de_tendencia(valores):
    n = len(valores)
    xs = range(n)
    media_x = sum(xs) / n
    media_y = sum(valores) / n
    a = sum((x - media_x) * (y - media_y) for x, y in zip(xs, valores)) / sum((x - media_x) ** 2 for x in xs)
    b = media_y - a * media_x
    return a, b


# produtos em alta
def produtos_em_alta(pedidos, ultimo_dia):
    inicio_recente = ultimo_dia - timedelta(days=JANELA - 1)
    inicio_anterior = inicio_recente - timedelta(days=JANELA)

    produtos = {}
    for p in pedidos:
        if p["status"] == "cancelado":
            continue
        dia = datetime.fromisoformat(p["data"]).date()
        for item in p["itens"]:
            vendas = produtos.setdefault(item["nome"], {"recentes": 0, "anteriores": 0})
            if dia >= inicio_recente:
                vendas["recentes"] += item["qtd"]
            elif dia >= inicio_anterior:
                vendas["anteriores"] += item["qtd"]

    lista = []
    for nome, v in produtos.items():
        if v["recentes"] == 0:
            continue
        lista.append({
            "nome": nome,
            "recentes": v["recentes"],
            "anteriores": v["anteriores"],
            "variacao": v["recentes"] - v["anteriores"],
            "previsao_7d": round(v["recentes"] / JANELA * 7),
        })

    # ordenação
    lista.sort(key=lambda r: (r["recentes"] + r["variacao"], r["recentes"]), reverse=True)
    return lista[:6]


# análise geral
def analisar(pedidos, dias_prever=7):
    por_dia = receita_por_dia(pedidos)
    if len(por_dia) < 3:
        return {"erro": "Poucos dados. Use 'Gerar dados de exemplo' mais abaixo."}

    # dias do período
    primeiro, ultimo = min(por_dia), max(por_dia)
    dias = [primeiro + timedelta(days=i) for i in range((ultimo - primeiro).days + 1)]
    valores = [por_dia.get(d, 0) for d in dias]

    # previsão
    a, b = reta_de_tendencia(valores)
    previsao = []
    for i in range(1, dias_prever + 1):
        y = max(0, a * (len(valores) - 1 + i) + b)
        previsao.append({"data": (ultimo + timedelta(days=i)).isoformat(), "valor": round(y, 2)})

    faturamento = sum(valores)
    qtd_pedidos = sum(1 for p in pedidos if p["status"] != "cancelado")
    return {
        "faturamento": round(faturamento, 2),
        "pedidos": qtd_pedidos,
        "ticket_medio": round(faturamento / qtd_pedidos, 2),
        "tendencia": "subindo" if a > 0 else "caindo",
        "real": [{"data": d.isoformat(), "valor": round(v, 2)} for d, v in zip(dias, valores)],
        "previsao": previsao,
        "total_previsto": round(sum(x["valor"] for x in previsao), 2),
        "produtos": produtos_em_alta(pedidos, ultimo),
    }
