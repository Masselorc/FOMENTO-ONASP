# Inicialização Automática do Servidor

Este guia explica como fazer o servidor HTTP iniciar automaticamente quando você ligar o computador.

## Opção 1: Usar o Script Batch (Mais Fácil) ⭐ Recomendado

### Passo 1: Copiar o arquivo para o Startup
1. Pressione `Win + R` e digite `shell:startup`
2. Uma pasta vai abrir (geralmente em `C:\Users\seu-usuario\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`)
3. Copie o arquivo `iniciar-servidor.bat` dessa pasta para a pasta do Startup

### Passo 2: Pronto!
Agora, sempre que você ligar o computador:
- Uma janela de comando vai abrir
- O servidor será iniciado com `npm start`
- Após 5 segundos, seu navegador abrirá automaticamente em `http://127.0.0.1:8790/index.html`

---

## Opção 2: Usar o Script PowerShell (Mais Avançado)

### Passo 1: Habilitar execução de scripts PowerShell
1. Pressione `Win + X` e escolha "PowerShell (Administrador)"
2. Digite o comando:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
3. Pressione `Y` e depois Enter para confirmar

### Passo 2: Copiar o arquivo para o Startup
1. Pressione `Win + R` e digite `shell:startup`
2. Copie o arquivo `iniciar-servidor.ps1` para essa pasta

### Passo 3: Pronto!
Segue o mesmo processo da Opção 1.

---

## Opção 3: Usar o Agendador de Tarefas (Mais Controle)

### Passo 1: Abrir o Agendador de Tarefas
1. Pressione `Win + R` e digite `taskschd.msc`
2. Clique em "Criar Tarefa Básica" no painel direito

### Passo 2: Configurar a Tarefa
1. **Nome**: Digite "FOMENTO-ONASP Server"
2. **Descrição**: Digite "Inicia o servidor HTTP automaticamente"
3. Clique em "Próximo"

### Passo 3: Definir o Gatilho
1. Selecione "Ao iniciar"
2. Clique em "Próximo"

### Passo 4: Definir a Ação
1. Selecione "Iniciar um programa"
2. **Programa/script**: Digite `cmd.exe`
3. **Adicionar argumentos**: Digite `/c cd "C:\Users\marcelo.cortez\OneDrive - MINISTERIO DA JUSTICA\1. SENAPPEN\2. OUVIDORIA\GITHUB\FOMENTO-ONASP" && npm start`
4. **Iniciar em**: Cole o caminho: `C:\Users\marcelo.cortez\OneDrive - MINISTERIO DA JUSTICA\1. SENAPPEN\2. OUVIDORIA\GITHUB\FOMENTO-ONASP`
5. Clique em "Próximo"

### Passo 5: Confirmar
1. Verifique as configurações
2. Clique em "Concluir"

### Passo 6: Criar Segunda Tarefa para Abrir o Navegador
Repita os passos 1-5, mas na Ação use:
- **Programa/script**: `cmd.exe`
- **Adicionar argumentos**: `/c start http://127.0.0.1:8790/index.html`

---

## Como Desativar a Inicialização Automática

### Se usou Batch ou PowerShell:
1. Pressione `Win + R` e digite `shell:startup`
2. Delete o arquivo `iniciar-servidor.bat` ou `iniciar-servidor.ps1`

### Se usou o Agendador de Tarefas:
1. Pressione `Win + R` e digite `taskschd.msc`
2. Procure por "FOMENTO-ONASP Server"
3. Clique com botão direito e escolha "Deletar"

---

## Verificar se está funcionando

Ao ligar o computador, você deve ver:
1. Uma janela de comando aberta com o servidor rodando
2. Seu navegador abrindo automaticamente na página `http://127.0.0.1:8790/index.html`

Se não funcionar:
- Verifique se o caminho do arquivo está correto
- Verifique se `npm` está instalado (teste digitando `npm --version` no cmd)
- Verifique se há alguma porta bloqueando a porta 8790
