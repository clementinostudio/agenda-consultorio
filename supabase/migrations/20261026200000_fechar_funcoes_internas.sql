-- As funções que só rodam como gatilho (criar o perfil no cadastro, marcar a hora da mudança)
-- não precisam ser chamadas pela internet: tira a permissão de chamar direto pela API.
-- (excluir_minha_conta continua liberada para quem está logado: é o botão "Excluir minha conta")
revoke execute on function public.criar_perfil() from public, anon, authenticated;
revoke execute on function public.marcar_atualizado() from public, anon, authenticated;
