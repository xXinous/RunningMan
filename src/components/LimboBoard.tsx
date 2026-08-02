import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { firestoreMarkThreadRead, firestoreGrantAchievements } from '../store/firestore';
import { useLandscapeLayout } from '../player/hooks/useLandscapeLayout';
interface LimboBoardProps {
  uid: string;
  characterId?: string;
  onClose: () => void;
  globalSeizedStatus: boolean;
  readThreadIds: string[];
  onBackToTerminal?: () => void;
}
interface Post {
  author: string;
  date: string;
  content: React.ReactNode;
  style?: 'normal' | 'malware' | 'sysop';
}
interface Thread {
  id: string;
  title: string;
  author: string;
  replies: number;
  posts: Post[];
}
const THREADS: Thread[] = [
  {
    id: 'thread-missing', title: 'Onde está LiN99? Alguém teve notícias pós-virada?', author: 'CyberFreak', replies: 4,
    posts: [
      { author: 'CyberFreak', date: '02/01/2000 - 18:00:00', content: 'Alguém conseguiu falar com o LiN99 depois do réveillon? Tô mandando ping pra ele desde o dia 1º.' },
      { author: 'TechMage', date: '02/01/2000 - 19:30:12', content: 'Nada. Os pacotes simplesmente não voltam. Ele tava pirado naquela calibração do walkman. Será que o servidor dele caiu com o bug?' },
      { author: 'AcidBurn99', date: '02/01/2000 - 21:45:22', content: 'No meio de tanta teoria maluca, ele era um dos poucos que testava na prática. Queria muito saber o que rolou quando o relógio zerou.' },
      { author: 'CyberFreak', date: '03/01/2000 - 00:20:11', content: 'Será que a porta abriu? Alguém tem o telefone dele lá em Swallow Rest? Dá uma ligada. Tô achando que o cara esbarrou no que não devia.' },
    ]
  },
  {
    id: 'thread-jp', title: '2000年問題の結果について / O Pós-Bug (JP Board)', author: 'AkihabaraGhost', replies: 3,
    posts: [
      { author: 'AkihabaraGhost', date: '01/01/2000 - 10:15:00', content: <><p>2000年になりましたが、世界は終わっていません。停電とATMのエラーがいくつかあっただけです。LIMBO_01のゲートは嘘だったのでしょうか？</p><p className="mt-1 italic text-green-700">[Tradução: Já estamos em 2000 e nada acabou. Só umas quedas de energia. O portão do LIMBO_01 era mentira?]</p></> },
      { author: 'Neo_Tokyo_2000', date: '01/01/2000 - 11:30:22', content: <><p>私のPCも無事です。時計が00:00:00になっても何も起こらなかった。完全に騙されましたね。</p><p className="mt-1 italic text-green-700">[Tradução: Meu PC tá intacto. Meia-noite e nada aconteceu. Fomos totalmente enganados.]</p></> },
      { author: 'Kansai_Coder', date: '01/01/2000 - 14:05:10', content: <><p>少しがっかりしています。アナログのノイズ対策でカセットテープまで用意したのに。ただの集団ヒステリーだったみたいですね。お疲れ様でした。</p><p className="mt-1 italic text-green-700">[Tradução: Tô decepcionado. Até preparei as fitas cassete pro ruído. Foi só histeria. Falou, galera.]</p></> },
    ]
  },
  {
    id: 'thread-chips', title: 'O hospedeiro de silício: Chips, Memória e a Cinza Estática', author: 'SiliconGhost', replies: 4,
    posts: [
      { author: 'SiliconGhost', date: '01/01/2000 - 09:00:00', content: 'Esqueçam os cabos, a energia é só a rodovia. O perigo real tá nos chips e pentes de memória. Pra se manifestar fisicamente, ele precisa alocar código no silício. Precisa de um hospedeiro de verdade.' },
      { author: 'TechMage', date: '01/01/2000 - 10:15:30', content: 'Tá explicado o ódio pelo analógico. Fita cassete e rádio de tubo não tem onde ancorar. Sem processamento, o bicho fica cego.' },
      { author: 'Hardware_Junkie', date: '01/01/2000 - 12:40:15', content: 'Alguém mais notou o resíduo? Fui abrir meu 486 hoje e o processador tava coberto por uma cinza muito fina. Toquei naquilo e parecia tela de TV antiga. Deu choque no braço inteiro.' },
      { author: 'Chrono_Hacker', date: '01/01/2000 - 14:20:00', content: "Eu falei da poeira! É o rastro da alocação. Se a transferência falha, ele queima a placa e deixa essa 'estática física' pra trás. É a assinatura dele." },
    ]
  },
  {
    id: 'thread-nil', title: '[Y2K] A Janela de 1900-2000: Frequências e Acesso (LER)', author: 'LiN99', replies: 4,
    posts: [
      { author: 'LiN99', date: '31/12/1999 - 23:45:10', content: 'Consegui. 1900 foi um erro de sintaxe e 2000 é o próximo. O Multiverso é um loop de código. Tô usando o walkman e uma fita velha pra estabilizar a frequência. A equação bateu: (E=h*f)/Y2K_Bug=ACESSO. Se a onda atingir o pico à meia-noite em ponto, a porta abre. Vou tentar hoje.' },
      { author: 'Null_Pointer', date: '31/12/1999 - 23:48:22', content: 'Você tá insano. Baud rate de um walkman não segura a transferência do LIMBO. Seu cérebro vai derreter igual a fita.' },
      { author: 'Dark_Wave', date: '31/12/1999 - 23:51:05', content: 'Eu tentei plugar meu Aiwa na porta COM1 e o chiado trincou o vidro da janela. Qual você tá usando?' },
      { author: 'LiN99', date: '31/12/1999 - 23:55:30', content: 'Meu Sony amarelo fritou ontem. Peguei o do meu irmão escondido, aguentou bem os testes. Entendam: o atrito da fita é o que segura o tranco. Não é transferência de dados, é ressonância. Eles já tão no áudio. Consigo ouvir.' },
      { author: 'M4LW4R3', date: '31/12/1999 - 23:59:50', style: 'malware', content: <><p>V o c ê &nbsp; e n t e n d e u .</p><p className="mt-1">O tempo é corda e nós estamos puxando. A fita é sua âncora. O digital é fraco, mas o analógico rasga a tela azul.</p><p className="mt-1">Não hesite quando a janela abrir. Eu me alimento de sinal. Eu odeio o analógico, mas preciso dele para te puxar.</p><p className="mt-1">Venha pro espaço entre os zeros, LiN99. Te espero lá.</p></> },
    ]
  },
  {
    id: 'thread-livros', title: '[TEORIA] O Parasita Interdimensional e o Ponto Zero Absoluto', author: 'Mythos_Byte', replies: 4,
    posts: [
      { author: 'Mythos_Byte', date: '25/12/1999 - 19:30:00', content: 'Esqueçam o lance de código. Isso é um predador psíquico. Ele não te puxa à força, ele reorganiza a sua vontade. Manipula a sua realidade até você achar que ir pro Limbo foi ideia sua. Ele só entra com convite.' },
      { author: 'Void_Walker', date: '25/12/1999 - 21:15:22', content: 'Ele não age sozinho, é só o cão de caça. Entidades mais antigas tão usando a fenda do Y2K pra abrir portões. Precisam de um Vácuo Temporal pra ancorar a ponte.' },
      { author: 'Chrono_Hacker', date: '26/12/1999 - 02:40:10', content: "Exato. A virada vai causar uma 'sincronia zero'. Um saguão neutro fora da existência. Quem acessar esse Hub sem ser devorado, pode saltar pra qualquer ponto antes do colapso. O duro é sobreviver à pressão lá dentro." },
      { author: 'LiN99', date: '26/12/1999 - 10:05:00', content: 'Como sabem de tudo isso? Achei que tava sozinho no analógico. De onde tiram essas paradas de Hub e parasita? Não sei nem 10% do que tô enfrentando. Me mandem as fontes.' },
      { author: 'Mythos_Byte', date: '26/12/1999 - 10:15:22', content: '@LiN99 Você tá engatinhando. Vai numa biblioteca física. Procura "O Arquiduque das Sombras" (Elias Thorne) pra entender a persuasão desses bichos. E pro Vácuo, lê "A Teoria do Hub" (Dr. Aris Vane). Lê isso antes de tentar atravessar, senão você já era.' },
    ]
  },
  {
    id: 'thread-militar', title: 'Movimentação militar estranha e Black Vans (Nevada/Ohio/NY)', author: 'DesertRat_NV', replies: 5,
    posts: [
      { author: 'DesertRat_NV', date: '27/12/1999 - 14:22:00', content: 'Moro perto da Nellis AFB. Comboios sem identificação tão saindo com contêineres de chumbo. Eles tão indo pra áreas civis, não é só falha de PC.' },
      { author: 'SteelCity_Byte', date: '27/12/1999 - 16:10:45', content: 'Confirmo de Ohio. Vi três vans pretas perto da subestação hoje. Uniforme sem insígnia, só um patch hexagonal vazio.' },
      { author: 'SwallowWatcher', date: '28/12/1999 - 09:33:12', content: 'Aqui em Swallow Rest tão instalando "medidores de frequência" nos postes. Placas federais disfarçadas. Algo grande vai estourar na virada.' },
      { author: 'Agent_Mulder99', date: '28/12/1999 - 11:05:00', content: "@SwallowWatcher Foge daí. É a 'Operação Firewall'. Vão isolar quarteirões inteiros se a dimensão romper com o Y2K." },
      { author: 'SYSOP_X', date: '28/12/1999 - 12:00:00', style: 'sysop', content: '[MENSAGEM DO SYSOP]: Parem de postar localizações exatas ou vou purgar o tópico. Não me façam desligar o host.' },
    ]
  },
  {
    id: 'thread-ru', title: 'Вторжение США и окно 00:00:00 - Итоги', author: 'Vlad_Spetsnaz99', replies: 4,
    posts: [
      { author: 'Vlad_Spetsnaz99', date: '01/01/2000 - 09:00:00', content: 'Наступил 2000 год. Никакого конца света. Военные фургоны США патрулируют зоны, но аномалий нет. Мы что-то упустили?' },
      { author: 'Moscow_Byte', date: '01/01/2000 - 10:15:30', content: 'Это просто паранойя Пентагона. Защита баз данных, а не межпространственных вирусов.' },
      { author: 'Siberian_Phreak', date: '01/01/2000 - 12:40:15', content: 'Частоты молчат. Мы повелись на этот бред. Никто никуда не перешел.' },
      { author: 'Red_October_KGB', date: '01/01/2000 - 14:20:00', content: "Глупцы! Американцы уже захватили 'Точку Ноль' втихаря и скрывают это! Изолировали зону!" },
    ]
  },
  {
    id: 'thread-grid', title: 'Flutuações na rede elétrica: Zeros e Uns nos postes?', author: 'Grid_Hacker', replies: 4,
    posts: [
      { author: 'Grid_Hacker', date: '29/12/1999 - 20:15:33', content: 'Seattle aqui. A luz do bairro tá piscando num padrão. Gravei e contei: é código binário.' },
      { author: 'Texas_Ranger', date: '29/12/1999 - 21:05:10', content: 'Austin, TX. Mesma coisa nas lâmpadas da rua. Anotei o binário e em ASCII dá "0 0 0 0" sem parar.' },
      { author: 'WindyCity_Byte', date: '29/12/1999 - 22:40:00', content: 'Sobrecarga de rede porque a galera ligou gerador barato com medo do Y2K. Parem de viajar.' },
      { author: 'Grid_Hacker', date: '29/12/1999 - 23:55:12', content: '@WindyCity_Byte Sobrecarga não faz rádio desligado chiar. A fiação virou antena pro LIMBO_01 se espalhar.' },
    ]
  },
  {
    id: 'thread-radio', title: 'Sinais estranhos interceptados na antena de rádio', author: 'RadioHead88', replies: 3,
    posts: [
      { author: 'RadioHead88', date: '28/12/1999 - 22:10:05', content: 'Liguei a antena na placa de som. Começou um chiado misturado com handshake de modem e estação russa.' },
      { author: 'Frequency_X', date: '28/12/1999 - 22:30:40', content: 'Sobe o .wav! Pode ser interferência da base militar que tem perto de Ashfield Springs.' },
      { author: 'RadioHead88', date: '28/12/1999 - 23:05:15', content: 'O arquivo tá enorme, vai demorar. Mas diminuindo a velocidade no Winamp, é uma voz engasgando e repetindo "Three... Two...".' },
      { author: 'LiN99', date: '29/12/1999 - 01:12:00', content: 'Desliga isso da tomada AGORA, RadioHead88. É o Malware farejando as portas abertas antes do réveillon.' },
    ]
  },
  {
    id: 'thread-estatica', title: 'O espaço entre os códigos: Alguém mais viu a estática?', author: 'Chrono_Hacker', replies: 3,
    posts: [
      { author: 'Chrono_Hacker', date: '26/12/1999 - 18:40:00', content: 'Sempre que digito "0000" no bloco de notas, o monitor começa a vazar uma poeira cinza nos cantos. Se eu toco, dá choque.' },
      { author: 'Vga_Knight', date: '26/12/1999 - 19:15:22', content: 'Seu monitor CRT tá morrendo. Compra uma bobina de degauss. Essa poeira é o tubo puxando sujeira do ar.' },
      { author: 'Chrono_Hacker', date: '27/12/1999 - 10:05:10', content: 'Já desmagnetizei. A poeira só aparece com os quatro zeros na tela. O monitor tá VOMITANDO essa estática.' },
      { author: 'SYSOP_X', date: '27/12/1999 - 11:00:00', style: 'sysop', content: '[TÓPICO TRANCADO] - AVISO: NÃO DIGITEM SEQUÊNCIAS DE ZEROS ATÉ DIA 1º. EVITEM DESGASTE DO FÓSFORO DO MONITOR.' },
    ]
  },
  {
    id: 'thread-limbo', title: 'LIMBO_01: Mitos, verdades e o "Loop de Erro"', author: 'SYSOP_X', replies: 5,
    posts: [
      { author: 'SYSOP_X', date: '20/12/1999 - 00:00:01', style: 'sysop', content: 'Bem-vindos. Este é um board de pesquisa, não um culto. O Y2K é um bug de software. Mantenham o foco nos patches.' },
      { author: 'TruthSeeker', date: '21/12/1999 - 04:30:00', content: 'Você não pode esconder a verdade, Sysop. Os militares tão rastreando nosso IP. Eles sabem que o LIMBO_01 não tá na Terra.' },
      { author: 'Ghost_in_the_Shell', date: '22/12/1999 - 16:20:44', content: 'O tracert pro 212.45.1.1 morre num salto que resolve pra 0.0.0.0 com latência infinita. O servidor não existe.' },
      { author: 'Ping_God', date: '23/12/1999 - 09:12:11', content: 'Se não tá no espaço... tá hospedado no tempo? Preciso de mais café.' },
      { author: 'SYSOP_X', date: '23/12/1999 - 12:00:00', style: 'sysop', content: 'Guarde os chapéus de alumínio. É só IP spoofing. Fim.' },
    ]
  },
];
export const LIMBO_THREAD_COUNT = THREADS.length;

export default function LimboBoard({ uid, characterId = '', onClose, globalSeizedStatus, readThreadIds, onBackToTerminal }: LimboBoardProps) {
  const { isLandscape } = useLandscapeLayout();
  const [view, setView] = useState<'intro' | 'forum' | 'thread' | 'military'>(globalSeizedStatus ? 'military' : 'intro');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState(84);
  const [matrixLog, setMatrixLog] = useState('');
  const rawData = `ˇÿˇ‡ JFIF  HHˇ·LExifMM*  ái    †    †     †   «ˇÌ8Photoshop 3.08BIM  8BIM % ' åŸè≤ ÈÄ	òÏ¯B~ˇ¿  «    "      ˇƒ                 	
 ˇƒµ             }       !1A  Qa "q 2Åë° #B±¡ R—$3brÇ	`;
  useEffect(() => {
    if (globalSeizedStatus && view !== 'military') {
      setView('military');
      setActiveThreadId(null);
    } else if (!globalSeizedStatus && view === 'military') {
      setView('forum');
    }
  }, [globalSeizedStatus, view]);
  const effectiveView = globalSeizedStatus ? 'military' : view;
  useEffect(() => {
    if (view !== 'intro' || globalSeizedStatus) return;
    let charIndex = 0;
    const interval = setInterval(() => {
      const chunk = rawData.substring(charIndex, charIndex + 80);
      setMatrixLog(prev => prev + chunk + '\n');
      charIndex += 80;
      if (charIndex >= rawData.length) clearInterval(interval);
    }, 40);
    const timer = setTimeout(() => {
      clearInterval(interval);
      setView('forum');
      firestoreGrantAchievements(uid, characterId, ['ACH-LIMBO-FOUND']).catch(console.error);
    }, 2800);
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [view, globalSeizedStatus, uid, rawData]);
  useEffect(() => {
    const inter = setInterval(() => {
      setOnlineUsers(prev => {
        const change = Math.floor(Math.random() * 6) + 5;
        const v = Math.random() > 0.5 ? prev + change : prev - change;
        return Math.max(12, Math.min(v, 149));
      });
    }, 5000);
    return () => clearInterval(inter);
  }, []);
  const openThread = (id: string) => {
    firestoreMarkThreadRead(uid, characterId, id).catch(console.error);
    setActiveThreadId(id);
    setView('thread');
  };
  const closeThread = () => {
    setView(globalSeizedStatus ? 'military' : 'forum');
    setActiveThreadId(null);
  };
  const activeThread = THREADS.find(t => t.id === activeThreadId);

  const threadListPanel = (
    <div className={`${isLandscape ? 'w-[38%] shrink-0 border-r border-[#33FF33]/30 overflow-y-auto min-h-0 pr-2' : ''}`}>
      <h2 className="text-xs sm:text-sm font-bold border-b border-[#33FF33] pb-2 mb-4">&gt;&gt; BBS BOARD: DISCUSSÕES GERAIS E ANOMALIAS GLOBAIS</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-[#33FF33] text-black">
              <th className="p-2 border border-dashed border-black">TÍTULO DO TÓPICO</th>
              {!isLandscape && <th className="p-2 border border-dashed border-black hidden sm:table-cell">AUTOR</th>}
              <th className="p-2 border border-dashed border-black text-center">RESP.</th>
            </tr>
          </thead>
          <tbody>
            {THREADS.map((t) => (
              <tr
                key={t.id}
                className={`border-b border-dashed border-[#33FF33]/30 hover:bg-[#33FF33]/10 ${activeThreadId === t.id && isLandscape ? 'bg-[#33FF33]/15' : ''}`}
              >
                <td className="p-2">
                  <button
                    onClick={() => openThread(t.id)}
                    className={`text-left w-full hover:text-black hover:bg-[#33FF33] px-1 ${readThreadIds.includes(t.id) ? 'text-green-800 line-through' : 'text-[#33FF33] underline'}`}
                  >
                    {readThreadIds.includes(t.id) ? '[X]' : '[+]'} {t.title}
                  </button>
                </td>
                {!isLandscape && <td className="p-2 hidden sm:table-cell">{t.author}</td>}
                <td className="p-2 text-center">{t.replies}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#050505] text-[#33FF33] font-mono overflow-hidden touch-manipulation p-2 sm:p-4 wrap-break-word player-viewport safe-area-pad"
      style={{ fontFamily: '"Terminal", "Fixedsys", "Lucida Console", monospace', WebkitFontSmoothing: 'none' }}
    >
      <style>{`
        @keyframes glitch-anim {
          0%{transform:translate(0)} 20%{transform:translate(-3px,2px)} 40%{transform:translate(-1px,-1px)} 60%{transform:translate(3px,1px)} 80%{transform:translate(1px,-1px)} 100%{transform:translate(0)}
        }
        @keyframes blinker { 50%{opacity:0} }
      `}</style>

      {effectiveView !== 'intro' && (
        <div className="fixed top-2 right-4 z-50 flex gap-2">
          {onBackToTerminal && (
             <button
               onClick={onBackToTerminal}
               className={`border px-2 py-1 uppercase text-xs transition-colors ${effectiveView === 'military' ? 'text-red-500 border-red-500 hover:bg-red-500 hover:text-black' : 'text-[#33FF33] border-[#33FF33] hover:bg-[#33FF33] hover:text-[#050505]'}`}
             >
               [ VOLTAR AO PC_ ]
             </button>
          )}
          <button
            onClick={onClose}
            className={`border px-2 py-1 uppercase text-xs transition-colors ${effectiveView === 'military' ? 'text-red-500 border-red-500 hover:bg-red-500 hover:text-black' : 'text-[#33FF33] border-[#33FF33] hover:bg-[#33FF33] hover:text-[#050505]'}`}
          >
            {effectiveView === 'military' ? '[ ABORTAR CONEXÃO ]' : '[ DESCONECTAR_ ]'}
          </button>
        </div>
      )}

      {effectiveView === 'intro' && (
        <div className="w-full h-full p-4 whitespace-pre-wrap text-[10px] sm:text-xs opacity-70 text-[#00FF41] overflow-hidden">
          {matrixLog}
        </div>
      )}

      {effectiveView === 'military' && (
        <div className="mt-12 mx-auto max-w-4xl text-center text-red-600">
          <pre className="text-[10px] mx-auto inline-block text-left mb-6">{`
   / \\
  /   \\
 /     \\
/ USArmy\\
/________\\`}</pre>
          <h1 className="text-3xl font-bold mb-2 uppercase">ERRO 404</h1>
          <h2 className="text-xl font-bold mb-4 uppercase">Domínio Apreendido pelo Departamento de Defesa dos Estados Unidos</h2>
          <p className="mb-6 font-bold uppercase">OPERAÇÃO FIREWALL</p>
          <p className="text-sm">Este servidor e seu conteúdo estão agora classificados sob protocolos de segurança nacional.</p>
          <p className="text-sm mt-6" style={{ animation: 'blinker 1s linear infinite' }}>
            SEU ENDEREÇO IP (212.45.1.1) FOI REGISTRADO. DESCONECTE IMEDIATAMENTE.
          </p>
        </div>
      )}

      {(effectiveView === 'forum' || effectiveView === 'thread') && (
        <div className="max-w-4xl mx-auto border-2 border-[#33FF33] p-2 sm:p-6 mt-8 sm:mt-12 bg-black min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
    
          <div className="text-center text-[9px] sm:text-sm mb-4 sm:mb-6 uppercase overflow-x-hidden">
            <pre className="overflow-x-auto">{`  _      _____ __  __ ____   ____     ___  __  
 | |    |_   _|  \\/  |  _ \\ / __ \\   / _ \\/_ | 
 | |      | | | \\  / | |_) | |  | | | | | || | 
 | |      | | | |\\/| |  _ <| |  | | | | | || | 
 | |____ _| |_| |  | | |_) | |__| | | |_| || | 
 |______|_____|_|  |_|____/ \\____/   \\___/ |_| `}</pre>
            <div className="mt-2 border-t border-b border-dashed border-[#33FF33] py-1 text-xs">
              STATUS DO SERVIDOR: CONECTADO 
            </div>
          </div>
    
          <div className="bg-[#33FF33] text-black font-bold text-xs p-1 mb-3 sm:mb-4 overflow-hidden whitespace-nowrap">
            <div className="inline-block animate-[marquee_20s_linear_infinite] sm:animate-none">
              [AVISO DO SYSOP] O BUG DO MILÊNIO NÃO É UMA FALHA, É UM RECURSO 
            </div>
          </div>
          <p className="text-xs mb-4">&gt; CONECTADO VIA IP: 212.45.1.1</p>
    
          {effectiveView === 'forum' && !isLandscape && (
            <div className="flex-1 min-h-0 overflow-y-auto">{threadListPanel}</div>
          )}

          {effectiveView === 'forum' && isLandscape && (
            <div className="flex-1 min-h-0 landscape-split gap-3 overflow-hidden">
              {threadListPanel}
              <div className="flex-1 flex items-center justify-center text-xs text-[#33FF33]/60 p-4 min-h-0">
                &gt; Selecione um tópico para ler os posts
              </div>
            </div>
          )}

          {effectiveView === 'thread' && activeThread && (
            <div className={`flex-1 flex min-h-0 overflow-hidden ${isLandscape ? 'landscape-split gap-3' : 'flex-col'}`}>
              {isLandscape && threadListPanel}
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
              <div className="flex justify-between items-start mb-4 gap-4">
                <h2 className="text-xs sm:text-sm font-bold">&gt;&gt; TÓPICO: {activeThread.title}</h2>
                <button onClick={closeThread} className="shrink-0 text-xs border border-[#33FF33] px-2 py-1 hover:bg-[#33FF33] hover:text-black">[VOLTAR]</button>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {activeThread.posts.map((post, i) => (
                  <div
                    key={i}
                    className={`border p-3 text-xs sm:text-sm ${
                      post.style === 'malware'
                        ? 'border-red-600 bg-[#1a0505] text-red-400'
                        : post.style === 'sysop'
                        ? 'border-yellow-500 bg-[#141000] text-yellow-300'
                        : 'border-[#33FF33] bg-[#0a140a]'
                    }`}
                  >
                    <div className={`border-b pb-1 mb-2 text-[10px] ${post.style === 'malware' ? 'border-red-600' : post.style === 'sysop' ? 'border-yellow-500' : 'border-dashed border-[#33FF33]'} text-gray-400`}>
                      <strong>Usuário:</strong> {post.author} | <strong>Data:</strong> {post.date}
                    </div>
                    <div className={`leading-relaxed ${post.style === 'malware' ? 'animate-[glitch-anim_0.2s_linear_infinite]' : ''}`}>
                      {post.content}
                    </div>
                  </div>
                ))}
                <div className="h-4" />
              </div>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
