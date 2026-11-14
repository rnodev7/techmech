// login
(() => {
    'use strict';

    const CHAVE = 'techmech-admin-token';
    const ler = () => { try { return sessionStorage.getItem(CHAVE); } catch (_) { return null; } };

    window.Auth = {
        async entrar(senha) {
            const CFG = window.TECHMECH || {};
            if (!window.Banco || !Banco.configurado()) {
                return { ok: false, erro: 'Falta preencher o config.js com os dados do Supabase.' };
            }
            try {
                const r = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/auth/v1/token?grant_type=password', {
                    method: 'POST',
                    headers: { apikey: CFG.supabaseChave, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: CFG.adminEmail, password: senha })
                });
                const d = await r.json().catch(() => null);
                if (r.ok && d && d.access_token) {
                    sessionStorage.setItem(CHAVE, d.access_token);
                    return { ok: true };
                }
                if (r.status === 400) return { ok: false, erro: 'Senha incorreta.' };
                return { ok: false, erro: 'Não foi possível entrar (erro ' + r.status + '). Confira o config.js e se o usuário admin existe no Supabase.' };
            } catch (_) {
                return { ok: false, erro: 'Sem conexão com o Supabase. Confira sua internet e o config.js.' };
            }
        },
        logado: () => !!ler(),
        token: ler,
        sair() { try { sessionStorage.removeItem(CHAVE); } catch (_) {} },
        // chamadas do admin
        fetch: (url, opc = {}) => Banco.admin(url, opc)
    };
})();
