import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import { db } from '../../lib/firebase';
import { doc, collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { userService } from '../../services/UserService';
import {
  adminAnalyticsService,
  PlayEvent,
  AudioMetadata,
  UserAchievement,
  UserData,
} from '../../services/AdminAnalyticsService';
import { MasterAccount, CharacterData, PlayerStats } from '../../types/player';
import { Campaign } from '../../data/campaigns';
import SpotlightSearch, { buildSearchItems } from './SpotlightSearch';
import Sidebar from './Sidebar';
import Header from './Header';
const UserRegistry = React.lazy(() => import('./UserRegistry'));
const GroupManager = React.lazy(() => import('./GroupManager'));
const AnalyticsPanel = React.lazy(() => import('./AnalyticsPanel'));
const AchievementsPanel = React.lazy(() => import('./AchievementsPanel'));
const TerminalPanel = React.lazy(() => import('./TerminalPanel'));
const SystemLogPanel = React.lazy(() => import('./SystemLogPanel'));
const RedirectsPanel = React.lazy(() => import('./RedirectsPanel'));
const JukeboxPanel = React.lazy(() => import('./JukeboxPanel'));
const CampaignsPanel = React.lazy(() => import('./CampaignsPanel'));
const AcervoPanel = React.lazy(() => import('./AcervoPanel'));

interface DashboardProps {
  user: User | null;
  onLogout: () => void;
}

interface TopStats {
  totalUsers: number;
  activeUsers7d: number;
  totalAudios: number;
  totalPlays: number;
}

interface AgentMetrics {
  active: number;
  vivo: number;
  morto: number;
  desaparecido: number;
  highDanger: number;
  archived: number;
}

interface CampaignMetrics {
  ativa: number;
  bloqueada: number;
  arquivada: number;
  walkman: number;
  nokia: number;
}

interface HealthMetrics {
  suspended: number;
  dormant: number;
  errors24h: number;
  limboSeized: boolean;
}

interface EngagementMetrics {
  totalAchievements: number;
  totalScrews: number;
  totalFidgets: number;
  totalEjects: number;
}

type IntelSubTabId = 'acervo' | 'jukebox' | 'qr' | 'conquistas';
type MissionTabId = 'dados' | 'vinculos' | 'inventario';

interface MetricNavigationOptions {
  intelSubTab?: IntelSubTabId;
  scrollTo?: string;
  openMissionId?: string;
  missionTab?: MissionTabId;
}

function formatSessionDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function countActiveUsers7d(users: MasterAccount[]): number {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return users.filter((u) => {
    if (!u.lastLogin?.toDate) return false;
    return u.lastLogin.toDate() >= sevenDaysAgo;
  }).length;
}

function countDormantUsers(users: MasterAccount[]): number {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return users.filter((u) => {
    if (!u.lastLogin?.toDate) return false;
    return u.lastLogin.toDate() < thirtyDaysAgo;
  }).length;
}

function computeAgentMetrics(characters: { uid: string; char: CharacterData }[]): AgentMetrics {
  const metrics: AgentMetrics = {
    active: 0,
    vivo: 0,
    morto: 0,
    desaparecido: 0,
    highDanger: 0,
    archived: 0,
  };

  characters.forEach(({ char }) => {
    if (char.archived) {
      metrics.archived++;
      return;
    }
    metrics.active++;
    if (char.agentStatus === 'vivo') metrics.vivo++;
    else if (char.agentStatus === 'morto') metrics.morto++;
    else if (char.agentStatus === 'desaparecido') metrics.desaparecido++;
    if ((char.dangerLevel ?? 1) >= 4) metrics.highDanger++;
  });

  return metrics;
}

function computeCampaignMetrics(campaigns: Campaign[]): CampaignMetrics {
  const metrics: CampaignMetrics = {
    ativa: 0,
    bloqueada: 0,
    arquivada: 0,
    walkman: 0,
    nokia: 0,
  };

  campaigns.forEach((c) => {
    if (c.status === 'Ativa') metrics.ativa++;
    else if (c.status === 'Bloqueada') metrics.bloqueada++;
    else if (c.status === 'Arquivada') metrics.arquivada++;
    if (c.playerType === 'walkman') metrics.walkman++;
    else if (c.playerType === 'nokia') metrics.nokia++;
  });

  return metrics;
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set(['dashboard']));
  const [intelTab, setIntelTab] = useState<IntelSubTabId>('acervo');
  const [missionDeepLink, setMissionDeepLink] = useState<{
    campaignId: string;
    tab?: MissionTabId;
  } | null>(null);
  const [topStats, setTopStats] = useState<TopStats>({
    totalUsers: 0,
    activeUsers7d: 0,
    totalAudios: 0,
    totalPlays: 0,
  });
  const [sessionDuration, setSessionDuration] = useState('00:00:00');
  const [agentMetrics, setAgentMetrics] = useState<AgentMetrics>({
    active: 0,
    vivo: 0,
    morto: 0,
    desaparecido: 0,
    highDanger: 0,
    archived: 0,
  });
  const [campaignMetrics, setCampaignMetrics] = useState<CampaignMetrics>({
    ativa: 0,
    bloqueada: 0,
    arquivada: 0,
    walkman: 0,
    nokia: 0,
  });
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics>({
    suspended: 0,
    dormant: 0,
    errors24h: 0,
    limboSeized: false,
  });
  const [engagementMetrics, setEngagementMetrics] = useState<EngagementMetrics>({
    totalAchievements: 0,
    totalScrews: 0,
    totalFidgets: 0,
    totalEjects: 0,
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [allAccounts, setAllAccounts] = useState<MasterAccount[]>([]);
  const [allCharacters, setAllCharacters] = useState<{ uid: string; char: CharacterData }[]>([]);

  const sessionStartRef = useRef(Date.now());
  const aggregatedPlaysRef = useRef<number | null>(null);
  const playEventsCountRef = useRef(0);

  const updateTotalPlays = () => {
    const totalPlays = aggregatedPlaysRef.current ?? playEventsCountRef.current;
    setTopStats((prev) => ({ ...prev, totalPlays }));
  };

  useEffect(() => {
    setMountedTabs((prev) => new Set(prev).add(activeTab));
  }, [activeTab]);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    setIsAdmin(true);
  }, [user]);

  useEffect(() => {
    const tick = () => setSessionDuration(formatSessionDuration(Date.now() - sessionStartRef.current));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const users = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as MasterAccount));
        setTopStats((prev) => ({
          ...prev,
          totalUsers: users.length,
          activeUsers7d: countActiveUsers7d(users),
        }));
        setHealthMetrics((prev) => ({
          ...prev,
          suspended: users.filter((u) => u.suspended).length,
          dormant: countDormantUsers(users),
        }));
      },
      (err) => console.warn('[Dashboard] users listener error:', err),
    );

    const unsubAudios = onSnapshot(
      collection(db, 'mediaAssets'),
      (snap) => {
        const totalAudios = snap.docs.filter((d) => (d.data() as { type?: string }).type === 'audio').length;
        setTopStats((prev) => ({ ...prev, totalAudios }));
      },
      (err) => console.warn('[Dashboard] mediaAssets listener error:', err),
    );

    const unsubPlayEvents = onSnapshot(
      collection(db, 'playEvents'),
      (snap) => {
        playEventsCountRef.current = snap.size;
        updateTotalPlays();
      },
      (err) => console.warn('[Dashboard] playEvents listener error:', err),
    );

    const unsubAgg = adminAnalyticsService.subscribeToAggregatedAnalytics((data) => {
      aggregatedPlaysRef.current = data?.totalPlays ?? null;
      updateTotalPlays();
    });

    const unsubCharacters = userService.subscribeToAllCharacters((characters) => {
      setAgentMetrics(computeAgentMetrics(characters));
    });

    const unsubCampaigns = onSnapshot(
      collection(db, 'campaigns'),
      (snap) => {
        const campaigns = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Campaign));
        setCampaignMetrics(computeCampaignMetrics(campaigns));
      },
      (err) => console.warn('[Dashboard] campaigns listener error:', err),
    );

    const unsubActivityLog = onSnapshot(
      query(collection(db, 'activityLog'), orderBy('timestamp', 'desc'), limit(200)),
      (snap) => {
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
        const errors24h = snap.docs.filter((d) => {
          const data = d.data();
          if (data.type !== 'error') return false;
          const ts = data.timestamp;
          if (!ts?.toDate) return false;
          return ts.toDate().getTime() >= twentyFourHoursAgo;
        }).length;
        setHealthMetrics((prev) => ({ ...prev, errors24h }));
      },
      (err) => console.warn('[Dashboard] activityLog listener error:', err),
    );

    const unsubLimbo = onSnapshot(
      doc(db, 'system', 'limboState'),
      (snap) => {
        const seized = snap.exists() ? Boolean(snap.data()?.seized) : false;
        setHealthMetrics((prev) => ({ ...prev, limboSeized: seized }));
      },
      (err) => console.warn('[Dashboard] limboState listener error:', err),
    );

    const unsubEngagement = adminAnalyticsService.subscribeToRawData((data) => {
      const analytics = adminAnalyticsService.computeAnalytics(
        data.playEvents as PlayEvent[],
        data.users as UserData[],
        data.audios as AudioMetadata[],
        data.unlockedAchievements as UserAchievement[],
        data.stats as PlayerStats[],
      );
      setEngagementMetrics({
        totalAchievements: analytics.totalAchievements,
        totalScrews: analytics.totalScrews,
        totalFidgets: analytics.totalFidgets,
        totalEjects: analytics.totalEjects,
      });
    });

    return () => {
      unsubUsers();
      unsubAudios();
      unsubPlayEvents();
      unsubAgg();
      unsubCharacters();
      unsubCampaigns();
      unsubActivityLog();
      unsubLimbo();
      unsubEngagement();
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchRecentItems = async () => {
      try {
        const userResult = await userService.fetchUsersPage(20);
        setAllAccounts(userResult.users);

        const charPromises = userResult.users.map((u) => userService.fetchCharactersForUser(u.uid));
        const charResults = await Promise.all(charPromises);

        const combined: { uid: string; char: CharacterData }[] = [];
        userResult.users.forEach((acc, i) => {
          charResults[i].forEach((char) => {
            combined.push({ uid: acc.uid, char });
          });
        });
        setAllCharacters(combined);
      } catch (err) {
        console.error('Erro ao carregar itens recentes para Spotlight:', err);
      }
    };

    fetchRecentItems();
  }, [isAdmin]);

  useEffect(() => {
    const tabOrder = ['dashboard', 'missions', 'players', 'squads', 'intel', 'systems'];
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSpotlightOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '8') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (tabOrder[idx]) setActiveTab(tabOrder[idx]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const spotlightItems = useMemo(() => {
    return buildSearchItems(allAccounts, allCharacters, setActiveTab);
  }, [allAccounts, allCharacters]);

  const navigateToMetric = useCallback((tab: string, options?: MetricNavigationOptions) => {
    setActiveTab(tab);
    if (options?.intelSubTab) setIntelTab(options.intelSubTab);
    if (options?.openMissionId) {
      setMissionDeepLink({
        campaignId: options.openMissionId,
        tab: options.missionTab,
      });
    }
    if (options?.scrollTo) {
      window.setTimeout(() => {
        document.getElementById(options.scrollTo!)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }, []);

  const handleNavigateToMission = useCallback((campaignId: string, tab: MissionTabId = 'vinculos') => {
    navigateToMetric('missions', { openMissionId: campaignId, missionTab: tab });
  }, [navigateToMetric]);

  return (
    <div className="h-screen bg-surface flex relative overflow-hidden font-sans">
      <div className="noise-overlay" />
      <div className="scanlines" />

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <Header user={user} onLogout={onLogout} onSpotlight={() => setSpotlightOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar bg-surface/50 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard label="Usuários" value={topStats.totalUsers} icon="group" color="primary" onClick={() => navigateToMetric('players')} />
              <StatCard label="Ativos 7d" value={topStats.activeUsers7d} icon="trending_up" color="tertiary" onClick={() => navigateToMetric('players')} />
              <StatCard label="Arquivos de Áudio" value={topStats.totalAudios} icon="library_music" color="tertiary" onClick={() => navigateToMetric('intel', { intelSubTab: 'acervo' })} />
              <StatCard
                label="Reproduções"
                value={topStats.totalPlays}
                icon="play_circle"
                color="secondary"
                onClick={() => navigateToMetric('dashboard', { scrollTo: 'admin-analytics' })}
              />
              <SessionCard duration={sessionDuration} />
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <React.Suspense
                fallback={
                  <div className="flex items-center justify-center p-24">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                      <p className="text-[10px] font-display font-bold text-primary uppercase tracking-[0.4em] animate-pulse">
                        Acessando_Dados...
                      </p>
                    </div>
                  </div>
                }
              >
                {mountedTabs.has('dashboard') && (
                  <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
                    <div className="space-y-8">
                      <OperationalPanorama
                        agents={agentMetrics}
                        campaigns={campaignMetrics}
                        health={healthMetrics}
                        engagement={engagementMetrics}
                        onNavigate={navigateToMetric}
                      />
                      <div id="admin-analytics">
                        <AnalyticsPanel onNavigate={navigateToMetric} />
                      </div>
                      <div id="admin-system-log" className="border-t border-primary/10 pt-8">
                        <SectionDivider title="Log_Central_do_Nucleo" />
                        <SystemLogPanel />
                      </div>
                    </div>
                  </div>
                )}

                {mountedTabs.has('missions') && (
                  <div className={activeTab === 'missions' ? 'block' : 'hidden'}>
                    <CampaignsPanel
                      missionDeepLink={missionDeepLink}
                      onDeepLinkConsumed={() => setMissionDeepLink(null)}
                    />
                  </div>
                )}

                {mountedTabs.has('players') && (
                  <div className={activeTab === 'players' ? 'block' : 'hidden'}>
                    <UserRegistry isAdmin={isAdmin} />
                  </div>
                )}

                {mountedTabs.has('squads') && (
                  <div className={activeTab === 'squads' ? 'block' : 'hidden'}>
                    <GroupManager
                      isAdmin={isAdmin}
                      onNavigateToMission={handleNavigateToMission}
                    />
                  </div>
                )}

                {mountedTabs.has('intel') && (
                  <div className={activeTab === 'intel' ? 'block' : 'hidden'}>
                    <div className="bg-surface-container-low border border-primary/20 overflow-hidden rounded-sm shadow-xl">
                      <div className="flex flex-wrap border-b border-primary/10 bg-black/20">
                        <IntelSubTab label="Acervo" active={intelTab === 'acervo'} onClick={() => setIntelTab('acervo')} icon="hub" />
                        <IntelSubTab label="Jukebox" active={intelTab === 'jukebox'} onClick={() => setIntelTab('jukebox')} icon="queue_music" />
                        <IntelSubTab label="QR & Links" active={intelTab === 'qr'} onClick={() => setIntelTab('qr')} icon="qr_code" />
                        <IntelSubTab label="Conquistas" active={intelTab === 'conquistas'} onClick={() => setIntelTab('conquistas')} icon="emoji_events" />
                      </div>

                      <div className="p-4 sm:p-8">
                        {intelTab === 'acervo' && <AcervoPanel embedded />}
                        {intelTab === 'jukebox' && <JukeboxPanel />}
                        {intelTab === 'qr' && <RedirectsPanel />}
                        {intelTab === 'conquistas' && <AchievementsPanel />}
                      </div>
                    </div>
                  </div>
                )}

                {mountedTabs.has('systems') && (
                  <div className={activeTab === 'systems' ? 'block' : 'hidden'}>
                    <div className="space-y-8">
                      <TerminalPanel />
                    </div>
                  </div>
                )}
              </React.Suspense>
            </div>
          </div>
        </main>

        <footer className="h-8 border-t border-primary/10 bg-surface-container-low/50 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse glow-orange" />
            <span className="text-[8px] font-display font-bold uppercase tracking-[0.3em] text-industrial-silver/40">
              Sincronização de Dados em Tempo Real
            </span>
          </div>
          <span className="text-[8px] font-display font-bold uppercase tracking-[0.3em] text-industrial-silver/20">
            RM_ADMIN_SYSTEM_V4.0 // ENCRYPTED_NODE
          </span>
        </footer>
      </div>

      <SpotlightSearch open={spotlightOpen} onClose={() => setSpotlightOpen(false)} items={spotlightItems} />
    </div>
  );
}

function OperationalPanorama({
  agents,
  campaigns,
  health,
  engagement,
  onNavigate,
}: {
  agents: AgentMetrics;
  campaigns: CampaignMetrics;
  health: HealthMetrics;
  engagement: EngagementMetrics;
  onNavigate: (tab: string, options?: MetricNavigationOptions) => void;
}) {
  const goPlayers = () => onNavigate('players');
  const goMissions = () => onNavigate('missions');
  const goSystems = () => onNavigate('systems');
  const goAnalytics = () => onNavigate('dashboard', { scrollTo: 'admin-analytics' });
  const goLog = () => onNavigate('dashboard', { scrollTo: 'admin-system-log' });
  const goAchievements = () => onNavigate('intel', { intelSubTab: 'conquistas' });

  return (
    <div className="space-y-6">
      <SectionDivider title="Panorama_Operacional" />

      <MetricGroup title="Agentes">
        <StatCard label="Agentes Ativos" value={agents.active} icon="badge" color="primary" onClick={goPlayers} />
        <StatCard label="Vivos" value={agents.vivo} icon="favorite" color="tertiary" onClick={goPlayers} />
        <StatCard label="Mortos" value={agents.morto} icon="skull" color="secondary" onClick={goPlayers} />
        <StatCard label="Desaparecidos" value={agents.desaparecido} icon="help" color="secondary" onClick={goPlayers} />
        <StatCard label="Alto Perigo" value={agents.highDanger} icon="warning" color="primary" onClick={goPlayers} />
        <StatCard label="Arquivados" value={agents.archived} icon="inventory_2" color="secondary" onClick={goPlayers} />
      </MetricGroup>

      <MetricGroup title="Campanhas">
        <StatCard label="Ativas" value={campaigns.ativa} icon="flag" color="primary" onClick={goMissions} />
        <StatCard label="Bloqueadas" value={campaigns.bloqueada} icon="lock" color="secondary" onClick={goMissions} />
        <StatCard label="Arquivadas" value={campaigns.arquivada} icon="archive" color="secondary" onClick={goMissions} />
        <StatCard label="Walkman" value={campaigns.walkman} icon="headphones" color="tertiary" onClick={goMissions} />
        <StatCard label="Nokia" value={campaigns.nokia} icon="smartphone" color="tertiary" onClick={goMissions} />
      </MetricGroup>

      <MetricGroup title="Saúde do Sistema">
        <StatCard label="Suspensos" value={health.suspended} icon="block" color="secondary" onClick={goPlayers} />
        <StatCard label="Dormentes" value={health.dormant} icon="bedtime" color="secondary" onClick={goPlayers} />
        <StatCard label="Erros 24h" value={health.errors24h} icon="error" color="primary" onClick={goLog} />
        <StatusCard
          label="Limbo"
          value={health.limboSeized ? 'TOMADO' : 'LIVRE'}
          icon="security"
          active={health.limboSeized}
          onClick={goSystems}
        />
      </MetricGroup>

      <MetricGroup title="Engajamento">
        <StatCard label="Conquistas" value={engagement.totalAchievements} icon="emoji_events" color="primary" onClick={goAchievements} />
        <StatCard label="Parafuso" value={engagement.totalScrews} icon="build" color="tertiary" onClick={goAnalytics} />
        <StatCard label="Fidget" value={engagement.totalFidgets} icon="touch_app" color="tertiary" onClick={goAnalytics} />
        <StatCard label="Eject sem Play" value={engagement.totalEjects} icon="eject" color="secondary" onClick={goAnalytics} />
      </MetricGroup>
    </div>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="h-px flex-1 bg-linear-to-r from-transparent to-primary/20" />
      <h3 className="text-industrial-silver/40 font-display text-[10px] uppercase font-bold tracking-[0.3em]">{title}</h3>
      <div className="h-px flex-1 bg-linear-to-l from-transparent to-primary/20" />
    </div>
  );
}

function MetricGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="font-display text-[9px] uppercase font-bold tracking-[0.25em] text-industrial-silver/30">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">{children}</div>
    </div>
  );
}

function SessionCard({ duration }: { duration: string }) {
  return (
    <div className="bg-surface-container-low border border-primary/20 p-5 flex flex-col justify-center relative group overflow-hidden">
      <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 -rotate-45 translate-x-8 -translate-y-8" />
      <p className="font-display text-[10px] uppercase font-bold tracking-[0.2em] text-primary/60 mb-1">Sessão_Ativa</p>
      <p className="text-3xl font-display font-bold text-white tracking-tight">{duration}</p>
      <p className="font-display text-[8px] uppercase tracking-[0.3em] text-industrial-silver/30 mt-1">NÚCLEO_OPERACIONAL</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  onClick,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
  onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    primary: 'text-primary border-primary/20',
    secondary: 'text-secondary border-secondary/20',
    tertiary: 'text-tertiary border-tertiary/20',
  };

  const iconColorMap: Record<string, string> = {
    primary: 'text-primary/20',
    secondary: 'text-secondary/20',
    tertiary: 'text-tertiary/20',
  };

  const className = `bg-surface-container-low border p-5 relative overflow-hidden group transition-all hover:bg-surface-container-high ${
    onClick ? 'cursor-pointer hover:border-primary/40 active:scale-[0.98]' : ''
  } ${colorMap[color] ?? colorMap.primary}`;

  const content = (
    <>
      {onClick && (
        <span className="absolute top-3 right-3 material-symbols-outlined text-sm text-primary/0 group-hover:text-primary/50 transition-all">
          arrow_forward
        </span>
      )}
      <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:opacity-20 transition-all group-hover:scale-110">
        <span className={`material-symbols-outlined text-6xl ${iconColorMap[color] ?? iconColorMap.primary}`}>{icon}</span>
      </div>
      <p className="font-display text-[10px] uppercase font-bold tracking-[0.2em] text-industrial-silver/50 mb-2">
        {label.replace(/ /g, '_')}
      </p>
      <div className="flex items-end gap-2">
        <p className="text-4xl font-display font-bold text-white tracking-tighter">{value}</p>
        <div className="mb-1.5 flex gap-0.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`w-1 h-3 rounded-full ${i <= 2 ? 'bg-primary/40' : 'bg-white/5'}`} />
          ))}
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} text-left w-full`}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function StatusCard({
  label,
  value,
  icon,
  active,
  onClick,
}: {
  label: string;
  value: string;
  icon: string;
  active: boolean;
  onClick?: () => void;
}) {
  const className = `bg-surface-container-low border p-5 relative overflow-hidden group transition-all hover:bg-surface-container-high ${
    onClick ? 'cursor-pointer hover:border-primary/40 active:scale-[0.98]' : ''
  } ${active ? 'border-red-500/30 text-red-400' : 'border-emerald-500/20 text-emerald-400'}`;

  const content = (
    <>
      {onClick && (
        <span className="absolute top-3 right-3 material-symbols-outlined text-sm text-primary/0 group-hover:text-primary/50 transition-all">
          arrow_forward
        </span>
      )}
      <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:opacity-20 transition-all group-hover:scale-110">
        <span className={`material-symbols-outlined text-6xl ${active ? 'text-red-500/20' : 'text-emerald-500/20'}`}>
          {icon}
        </span>
      </div>
      <p className="font-display text-[10px] uppercase font-bold tracking-[0.2em] text-industrial-silver/50 mb-2">
        {label.replace(/ /g, '_')}
      </p>
      <p className="text-2xl font-display font-bold tracking-tight">{value}</p>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} text-left w-full`}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function IntelSubTab({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-6 py-4 text-[10px] font-display font-bold tracking-[0.2em] transition-all border-r border-primary/10 uppercase ${
        active ? 'bg-primary text-black' : 'text-industrial-silver/50 hover:bg-primary/5 hover:text-primary'
      }`}
    >
      <span className="material-symbols-outlined text-base">{icon}</span>
      {label}
    </button>
  );
}
