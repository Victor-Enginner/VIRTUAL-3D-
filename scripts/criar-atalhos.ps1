# Cria o atalho "Escritório Virtual" na Área de Trabalho e na pasta do projeto, com o ícone do Prospector.
# Rode de novo depois de mover ou reinstalar o projeto (o atalho guarda o caminho). Seguro rodar várias vezes.
#   powershell -ExecutionPolicy Bypass -File scripts\criar-atalhos.ps1
# (o nome usa [char]0xF3 para o "ó" não depender da codificação deste arquivo)
$raiz = Split-Path -Parent $PSScriptRoot
$alvo = Join-Path $raiz 'iniciar-escritorio.bat'
$icone = Join-Path $raiz 'public\icone\prospector.ico'
if (-not (Test-Path $alvo)) { Write-Host "Nao achei $alvo"; exit 1 }
$nome = 'Escrit' + [char]0xF3 + 'rio Virtual.lnk'
$sh = New-Object -ComObject WScript.Shell
foreach ($pasta in @([Environment]::GetFolderPath('Desktop'), $raiz)) {
  $l = $sh.CreateShortcut((Join-Path $pasta $nome))
  $l.TargetPath = $alvo
  $l.WorkingDirectory = $raiz
  if (Test-Path $icone) { $l.IconLocation = "$icone,0" }
  $l.WindowStyle = 7   # minimizado: a janelinha preta não aparece
  $l.Description = 'Liga o Prospector e abre a Sala 3D'
  $l.Save()
  Write-Host "atalho: $(Join-Path $pasta $nome)"
}
