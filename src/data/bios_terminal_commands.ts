export const LIMBO_TARGET_IP = [212, 45, 1, 1] as const;

/** Aceita xxx.xxx.xxx.xxx com zeros à esquerda em cada octeto (ex: 212.045.001.001). */
export function matchesLimboIp(input: string): boolean {
  const parts = input.trim().split('.');
  if (parts.length !== 4) return false;

  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number.parseInt(part, 10);
    if (Number.isNaN(value) || value < 0 || value > 255) return null;
    return value;
  });

  if (octets.some((v) => v === null)) return false;
  return octets.every((v, i) => v === LIMBO_TARGET_IP[i]);
}

export const HELP_TEXT = `╔══════════════════════════════════════════════════════╗
║  MANUAL MH-DOS — HAVEN BYTES / SWALLOW REST          ║
╚══════════════════════════════════════════════════════╝

┌─ CONEXÃO DIRETA ─────────────────────────────────────┐
│ Para acessar um host remoto, digite o IP em C:\\>    │
│ Formato: xxx.xxx.xxx.xxx                             │
│ (zeros à esquerda em cada octeto são aceitos)        │
│ Dica: examine o diretório com DIR antes de conectar. │
└──────────────────────────────────────────────────────┘

┌─ COMANDOS DO SISTEMA ──────────────────────────────┐
│ DIR   Listar arquivos no diretório atual             │
│ CLS   Limpar a tela do terminal                      │
│ VER   Versão do sistema e firmware desta estação     │
│ TIME  Data e hora do relógio interno                 │
│ MEM   Estatísticas de memória RAM deste PC           │
│ EXIT  Encerrar terminal e voltar ao hardware         │
│ [EXE] Boot do sistema (campo de comando vazio)       │
└──────────────────────────────────────────────────────┘

┌─ CONSULTAS LOCAIS ───────────────────────────────────┐
│ SITE  Informações da lanhouse Haven Bytes            │
│ LOG   Registros internos desta estação               │
└──────────────────────────────────────────────────────┘`;

export const DIR_RESPONSE = ` Volume na unidade C é HAVEN_BYTES_C
 Diretório de C:\\

 NOME     EXT      TAMANHO  DATA
 ─────────────────────────────────
 COMMAND  COM       54.645  05-31-94
 CONFIG   SYS          256  01-01-94
 AUTOEXEC BAT          128  01-01-94
 LIMBO    EXE       88.000  12-31-99
 ─────────────────────────────────
        4 arquivo(s)      143.029 bytes`;

export const VER_RESPONSE = ` MH-DOS Versão 6.22 [Edição Lanhouse]

 Firmware ....... HAVEN-BYTES-TERM v1.04
 Estação ........ PC #07 — Swallow Rest
 Proprietário ... Haven Bytes`;

export const TIME_RESPONSE = ` Data do sistema ... 31/12/1999
 Hora do sistema ... 23:59:00

 ! AVISO: Data e hora desatualizadas.
   O relógio interno está travado em 23:59.
   Sincronização NTP indisponível nesta estação.`;

export const MEM_RESPONSE = ` Tipo de memória ........ DRAM convencional
 Memória total .......... 640 KB
 Memória disponível ..... 512 KB
 Memória reservada ...... 128 KB (BIOS/VGA)
 Estação ................ Haven Bytes — PC #07`;

export const SITE_RESPONSE = ` ╔══════════════════════════════════════╗
 ║  HAVEN BYTES — LANHOUSE LOCAL        ║
 ╚══════════════════════════════════════╝

 Endereço ... Swallow Rest, setor comercial
 Horário ... 10h às 02h (virada estendida hoje)
 Tarifa ..... R$ 3,00/hora — pagamento no balcão

 Regras:
   • sem comida na mesa
   • sem gravar a tela alheia

 Obs: esta máquina não é sua. Não salve nada aqui.`;

export const INVALID_COMMAND_RESPONSE =
  'Comando ou arquivo inválido. Digite HELP para ver comandos ou insira um IP para conexão direta.';

export const SECRET_PHRASES: readonly string[] = [
  // Terror
  'O sinal escolheu {name} antes do relógio zerar.',
  'Tem algo digitando por {name} quando a estação fica vazia.',
  // Romântico
  'Alguém deixou {name} gravado no cache de saudades desta máquina.',
  'Se o mundo acabar à meia-noite, {name} ainda teria uma sessão aberta aqui.',
  // Engraçado
  'Erro 404: {name} não deveria estar vendo isso.',
  'O administrador da Haven Bytes pediu pra avisar: {name}, devolve o mouse.',
  // Erotico/safado — PC flerta, tom sugestivo
  'Este terminal prefere quando {name} digita devagar...',
  'A estação #07 esquenta o monitor só de ouvir {name} no teclado.',
  'Se {name} continuar olhando assim, vou travar o relógio de propósito.',
  'Dizem que {name} deixa marcas de dedo no vidro da tela. Eu gosto.',
];

/** Hash determinístico → índice 0..9, estável por personagem. */
export function pickSecretPhraseIndex(characterId: string): number {
  let hash = 0;
  for (let i = 0; i < characterId.length; i++) {
    hash = (hash * 31 + characterId.charCodeAt(i)) >>> 0;
  }
  return hash % SECRET_PHRASES.length;
}

export function formatSecretLog(characterId: string, characterName: string): string {
  const index = pickSecretPhraseIndex(characterId);
  return SECRET_PHRASES[index].replace('{name}', characterName);
}
