# Atualizacoes pelo GitHub

O cliente executa `ATUALIZAR-SISTEMA.bat`. O arquivo apenas inicia o
atualizador PowerShell, que consulta a release mais recente do repositorio
configurado em `config\updater.cfg`.

## Publicar uma nova versao

1. Defina uma nova tag de versao em `version.txt` (por exemplo, `v2.1.1`).
2. Execute `npm run release:client` para gerar `release\NytharDashboard-2.0.zip`.
3. Crie uma GitHub Release com exatamente a mesma tag de `version.txt`.
4. Anexe o ZIP usando um nome iniciado por `NytharDashboard` e terminado em `.zip`.
5. Em uma instalacao de teste, execute `ATUALIZAR-SISTEMA.bat -Check` e confirme
   que as versoes instalada e disponivel aparecem corretamente.

O atualizador preserva `.env.local`, `.env`, `config\updater.cfg`, os bancos
SQLite usados pelo sistema e as pastas `.wwebjs_auth*` do WhatsApp. Ele valida
o ZIP antes da extracao e registra a tag instalada somente depois de restaurar
os dados.

Nao publique um ZIP com uma tag diferente do valor de `version.txt`: isso pode
fazer a instalacao procurar atualizacoes repetidamente ou deixar de identifica-las.
