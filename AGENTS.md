# AGENTS.md

> Guia de orientação para agentes de IA (Cursor, Copilot, Claude Code, etc.) trabalhando neste repositório.
> Leia este arquivo antes de editar código.

## O que é este projeto

**LimboOS** é um companion app web para campanhas de RPG de mesa. Jogadores interagem como **agentes** através de interfaces retro (walkman, Nokia, BIOS, Windows 95, Mac OS) para consumir **Intel** — conteúdo narrativo em áudio, texto, imagem, conquistas e, nos planos, vídeos e mapas interativos.

Não é um OS real: é uma **SPA fictícia** com imersão ARG, lore temporal (Limbo, fenda, bug do milênio) e painel administrativo para o mestre de jogo.

## Stack

| Camada | Tecnologia |
|--------|------------|
| UI | React 19, TypeScript, Tailwind CSS 4, Motion |
| Build | Vite 6 |
| Roteamento | React Router 7 |
| Backend | Firebase (Auth, Firestore, Storage, Analytics, Hosting) |
| Deploy | `npm run build` → `backend/dist` → Firebase Hosting |

## Repositórios relacionados (submódulos Git)

| Path | Conteúdo |
|------|----------|
| `backend/` | Firebase Hosting, rules, deploy (`LimboOS-backend`) |
| `mobile/` | App mobile (`LimboOS-mobile`) |

Se `backend/` estiver vazio, inicialize submódulos: `git submodule update --init --recursive`.

## Estrutura do código

```
src/
├── App.tsx                 # Router: Player, Admin, Terminal
├── Player.tsx              # Entry fino do jogador (providers + shell)
├── main.tsx                # Entry point React
├── player/                 # Orquestração do app jogador
│   ├── context/            # PlayerSessionProvider + usePlayerSession/Playback
│   ├── hooks/              # auth, intel, sync, walkman playback
│   ├── components/         # ScreenRouter, WalkmanShell, NokiaLayout...
│   ├── lazyScreens.ts      # React.lazy centralizado
│   └── types.ts            # Contratos de context
├── admin/                  # Painel administrativo (/admin)
│   ├── AdminApp.tsx
│   └── components/         # Dashboard, campanhas, intel, mídia, users...
├── terminal/               # Terminal fictício ARG (/terminal)
├── components/             # UI compartilhada e mini-apps
│   ├── player/             # Walkman, Nokia, controles, fitas
│   └── campaign/           # Seleção de campanha, dossiê, segurança
├── services/               # Lógica de negócio (singletons)
├── store/                  # Firestore CRUD + auth/profile
├── types/                  # Modelos TypeScript
├── data/                   # Registros estáticos (campanhas, intel, achievements)
└── lib/firebase.ts         # Inicialização Firebase

sms/                        # Diálogos de NPCs (conteúdo narrativo em Markdown)
```

## Três superfícies da aplicação

| Rota | Entry | Público |
|------|-------|---------|
| `/*` | `Player.tsx` | Jogadores |
| `/admin/*` | `admin/AdminApp.tsx` | Mestre / admin |
| `/terminal/*` | `terminal/TerminalApp.tsx` | ARG / easter egg |

Todas são lazy-loaded em `App.tsx` com `Suspense` + `RetroLoading`.

## Conceitos de domínio

| Termo | Significado |
|-------|-------------|
| **Intel** | Item colecionável unificado: `AUDIO`, `TEXT`, `VISUAL`, `META` (vídeo e mapas interativos planejados) |
| **AccessLevel** | Sigilo RPG: 1 RESTRITO → 4 TOP SECRET |
| **MasterAccount** | Conta Firebase (`users/{uid}`) |
| **CharacterData** | Agente/personagem do jogador |
| **Campaign** | Campanha de RPG com tema, sistema e `playerType` (`walkman` \| `nokia`) |
| **AppScreen** | Estado de navegação interna do Player (`login`, `player`, `bios`, `limbo`, etc.) |

### Fontes de Intel

1. **Local** — `src/data/intel_registry.ts` (hardcoded, lore fixa)
2. **Remota** — Firestore + admin (`IntelCreatorPanel`, `MediaLibraryPanel`)
3. **Runtime** — `IntelService` mescla local + remoto; `IntelEngine` aplica Strategy/Factory por tipo

## Modelo Firestore (resumo)

```
users/{uid}                              → MasterAccount
  └── characters/{characterId}           → CharacterData
        ├── intel/{intelId}              → itens desbloqueados
        └── achievements/{achievementId}

mediaAssets/{id}                         → biblioteca de mídia (admin)
campaigns/{id}                           → campanhas (via CampaignService)
playEvents/{id}                          → eventos de reprodução
qrRedirects/{id}                         → redirects de QR code
```

Persistência e queries: `src/store/firestore.ts`. Sync em tempo real do jogador: `src/services/PlayerSyncService.ts`.

## Serviços principais

| Serviço | Responsabilidade |
|---------|------------------|
| `IntelService` / `IntelEngine` | Catálogo, unlock, comportamento por tipo |
| `AudioEngine` | Reprodução de fitas |
| `CampaignService` | Campanhas (local + Firestore) |
| `AchievementManager` | Regras e desbloqueio de conquistas |
| `PlayerSyncService` | Snapshot listeners do estado do jogador |
| `UserService` | CRUD de contas e personagens (admin) |
| `ActivityLogger` / `AnalyticsTracker` | Telemetria e logs |

Padrão predominante: **classes singleton** exportadas como instância (`export const foo = Foo.getInstance()`).

## Comandos

```bash
npm run dev          # Dev server (Vite)
npm run build        # Build de produção → backend/dist
npm run preview      # Preview do build
npm run lint         # Type-check (tsc --noEmit) — não há ESLint separado
npm run deploy       # Build + Firebase Hosting (main)
npm run deploy:beta  # Build + Firebase Hosting (staging)
```

Após alterações de código, rode `npm run lint` no escopo alterado (ou no projeto inteiro).

## Variáveis de ambiente

Copie `.env.example` → `.env`. Prefixo `VITE_` é obrigatório para variáveis consumidas no frontend.

| Variável | Uso |
|----------|-----|
| `VITE_FIREBASE_*` | Config Firebase (obrigatório) |
| `GEMINI_API_KEY` | Integrações de IA (quando aplicável) |
| `APP_URL` | URL de hospedagem |

Nunca commite `.env` com credenciais reais.

## Convenções de código

- **TypeScript estrito** — tipos em `src/types/`; evite `any` sem necessidade.
- **Lazy loading** — telas pesadas e mini-apps via `React.lazy`.
- **Estilo visual** — retro/cyberpunk; fontes: Space Grotesk, Inter, JetBrains Mono; accent `#FF8C00`.
- **Idioma** — UI, lore e comentários em **português (BR)**; identificadores de código em inglês.
- **Escopo mínimo** — altere só o necessário; não refatore áreas não relacionadas à tarefa.
- **Sem testes automatizados** — o projeto não possui suíte de testes no momento; valide manualmente ou via `npm run lint`.

## Onde mexer para tarefas comuns

| Tarefa | Onde olhar |
|--------|------------|
| Fluxo do jogador / walkman | `src/Player.tsx`, `src/player/`, `src/components/player/` |
| Nova tela do jogador (`AppScreen`) | `src/player/components/PlayerScreenRouter.tsx` + `src/player/lazyScreens.ts` |
| Nova campanha (seed local) | `src/data/campaigns.ts` + Firestore via admin |
| Novo intel hardcoded | `src/data/intel_registry.ts` |
| Lógica de unlock / intel | `src/services/IntelService.ts`, `IntelEngine.ts` |
| Auth e perfil | `src/store/profile.ts`, `LoginScreen.tsx` |
| CRUD Firestore | `src/store/firestore.ts` |
| Painel admin | `src/admin/components/` |
| Conteúdo narrativo SMS | `sms/*.md` |
| Deploy / hosting | submódulo `backend/` |

## Guardrails

- **Não** modifique `vite.config.ts` (HMR/disabled) sem motivo explícito — comentário indica uso em AI Studio.
- **Não** commite secrets, `.env` ou `firebase-applet-config.json` com chaves reais.
- **Não** crie commits ou PRs sem o usuário pedir explicitamente.
- **Não** adicione README/docs extras sem solicitação — este `AGENTS.md` é o índice para IAs.
- Respeite o modelo **conta → personagem → intel**; progresso fica em `users/{uid}/characters/{charId}/intel`.
- Mini-apps (`BiosTerminal`, `LimboBoard`, `DiskRepairApp`, etc.) são experiências narrativas — preserve tom e imersão ao editar textos.

## Fluxo mental do jogador

```
Login → Seleção de personagem → Seleção de campanha → Dispositivo (walkman/nokia)
  → Consumo de Intel → Mini-apps desbloqueáveis (bios, limbo, terminal, win95...)
```

## Arquivos de entrada recomendados para contexto rápido

1. `AGENTS.md` (este arquivo)
2. `src/App.tsx` — rotas
3. `src/Player.tsx` — entry do jogador
4. `src/player/context/PlayerProviders.tsx` — estado de sessão e playback
5. `src/types/player.ts` + `src/types/intel.ts` — modelos
6. `src/services/IntelEngine.ts` — arquitetura do sistema Intel
7. `src/store/firestore.ts` — persistência

---

*Última revisão: jun/2026. Atualize este arquivo quando a arquitetura ou comandos mudarem.*
