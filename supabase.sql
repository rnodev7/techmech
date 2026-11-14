-- tabela de pedidos
create table if not exists public.pedidos (
    numero          text primary key,
    data            timestamptz not null default now(),
    status          text not null default 'pago' check (status in ('pago','enviado','entregue','cancelado')),
    itens           jsonb not null,
    subtotal        numeric(12,2) not null check (subtotal >= 0),
    cupom           text,
    desc_cupom      numeric(12,2) not null default 0,
    desc_pagamento  numeric(12,2) not null default 0,
    frete           numeric(12,2) not null default 0,
    frete_tipo      text not null check (frete_tipo in ('retirada','economico','expresso')),
    pagamento       text not null check (pagamento in ('pix','cartao','boleto')),
    parcelas        int  not null default 1 check (parcelas between 1 and 12),
    juros           boolean not null default false,
    total           numeric(12,2) not null check (total >= 0 and total < 1000000),
    demo            boolean not null default false
);

-- segurança
alter table public.pedidos enable row level security;

-- visitante cria pedido
drop policy if exists "loja cria pedidos" on public.pedidos;
create policy "loja cria pedidos" on public.pedidos
    for insert to anon
    with check (status = 'pago' and demo = false);

-- admin acessa tudo
drop policy if exists "admin faz tudo" on public.pedidos;
create policy "admin faz tudo" on public.pedidos
    for all to authenticated
    using      ((auth.jwt() ->> 'email') = 'rnofig@gmail.com')
    with check ((auth.jwt() ->> 'email') = 'rnofig@gmail.com');
