# Meu Financeiro — PWA para iPhone

Primeira versão funcional do assistente financeiro.

## O que já funciona
- Dashboard com renda, contas obrigatórias, dívidas e investimentos.
- Cálculo de dinheiro realmente livre para gastar.
- Limite diário sugerido até o fim do mês.
- Cadastro de receitas e despesas.
- Classificação em gasto livre, conta obrigatória, dívida/parcela e investimento.
- Alertas de ritmo de gastos.
- Cadastro de dívidas e estimativa simples de redução de prazo com aporte extra.
- Simulador de quantidade de cotas/ações para que o rendimento mensal cubra o valor de uma nova unidade.
- Dados gravados no próprio navegador do aparelho.
- Instalação como PWA na tela inicial do iPhone.

## Como testar
1. Publique esta pasta em um host HTTPS, como GitHub Pages, Netlify, Vercel ou Cloudflare Pages.
2. Abra o endereço no Safari do iPhone.
3. Toque em Compartilhar.
4. Escolha "Adicionar à Tela de Início".

Observação: abrir o arquivo index.html diretamente pelo app Arquivos não é suficiente para recursos de PWA/service worker.

## WhatsApp
A interface está preparada conceitualmente para integração, mas mensagens automáticas do WhatsApp exigem um backend/webhook.

Fluxo recomendado:
WhatsApp -> webhook/API -> parser da mensagem -> banco de dados -> PWA.

Exemplo:
"Gastei 35 no mercado"
=> tipo: despesa
=> valor: 35
=> categoria: Alimentação
=> classificação: gasto livre
=> descrição: Mercado

Para produção, recomenda-se WhatsApp Cloud API ou outro provedor compatível, conectado a um backend como Supabase Edge Functions, Firebase Functions ou servidor Node.

## Próxima etapa recomendada
Substituir localStorage por Supabase para:
- sincronizar vários aparelhos;
- permitir lançamentos vindos do WhatsApp;
- autenticação;
- backup;
- notificações e relatórios automáticos.
