import React, { useState, useEffect, useMemo } from 'react';
import { useModal } from './ConfirmModal';
import { adminAnalyticsService, PlayEvent, AudioMetadata, UserAchievement, UserData } from '../../services/AdminAnalyticsService';
import { PlayerStats } from '../../types/player';
import { intelRegistry } from '../../data/intel_registry';
import { activityLogger } from '../../services/ActivityLogger';

type IntelSubTabId = 'acervo' | 'jukebox' | 'qr' | 'conquistas';

interface MetricNavigationOptions {
  intelSubTab?: IntelSubTabId;
  scrollTo?: string;
}

interface AnalyticsPanelProps {
  onNavigate?: (tab: string, options?: MetricNavigationOptions) => void;
}

export default function AnalyticsPanel({ onNavigate }: AnalyticsPanelProps = {}) {
  const [playEvents, setPlayEvents] = useState<PlayEvent[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [audios, setAudios] = useState<AudioMetadata[]>([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<UserAchievement[]>([]);
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [aggregatedData, setAggregatedData] = useState<any>(null);
  const [isResetting, setIsResetting] = useState(false);
  const { showConfirm, showAlert, modal } = useModal();

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await adminAnalyticsService.resetAnalytics();
      activityLogger.logAdmin('gm.mpg', 'bi_reset', 'Resetou painel de BI (play events + stats)');
      await showAlert('Reset Concluído', '✅ Painel de BI resetado com sucesso!');
    } catch (e) {
      console.error('Falha ao resetar BI', e);
      await showAlert('Erro', 'Falha ao resetar os dados. Verifique o console.');
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    const unsubRaw = adminAnalyticsService.subscribeToRawData((data) => {
      setPlayEvents(data.playEvents);
      setUsers(data.users);
      setAudios(data.audios);
      setUnlockedAchievements(data.unlockedAchievements);
      setStats(data.stats);
    });

    const unsubAgg = adminAnalyticsService.subscribeToAggregatedAnalytics((data) => {
      setAggregatedData(data);
    });

    return () => {
      unsubRaw();
      unsubAgg();
    };
  }, []);

  const analytics = useMemo(() => {
    return adminAnalyticsService.computeAnalytics(playEvents, users, audios, unlockedAchievements, stats);
  }, [playEvents, users, audios, unlockedAchievements, stats]);

  // Merge aggregated data into analytics if available
  const displayAnalytics = useMemo(() => {
    if (!aggregatedData) return analytics;

    const dailyPlaysSorted = Object.entries(aggregatedData.dailyPlays || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30);
    
    const mostPlayed = Object.entries(aggregatedData.tapePlayCount || {})
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 10);

    return {
      ...analytics,
      totalPlays: aggregatedData.totalPlays || analytics.totalPlays,
      completedPlays: aggregatedData.completedPlays || analytics.completedPlays,
      activeUsers: aggregatedData.totalUsers || analytics.activeUsers,
      dailyPlaysSorted,
      maxDailyPlays: Math.max(...Object.values(aggregatedData.dailyPlays || {}).map(v => v as number), 1),
      mostPlayed,
      completionRate: (aggregatedData.totalPlays > 0) 
        ? ((aggregatedData.completedPlays || 0) / aggregatedData.totalPlays) * 100 
        : analytics.completionRate
    };
  }, [analytics, aggregatedData]);

  return (
    <div className="space-y-8 font-sans">
      {modal}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-8 bg-primary shadow-[0_0_10px_rgba(255,140,0,0.4)]" />
          <div>
            <h2 className="font-display font-bold uppercase tracking-widest text-lg text-white">Análise de Dados e BI</h2>
            <p className="text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mt-1">Monitoramento de Performance da Rede</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          disabled={isResetting}
          className={`px-6 py-3 ${isResetting ? 'bg-surface-container-high text-industrial-silver/20' : 'bg-red-500/5 text-red-500/60 hover:bg-red-500/10 hover:text-red-500'} border border-red-500/10 text-[10px] font-display font-bold uppercase tracking-widest transition-all flex items-center gap-3 rounded-sm active:scale-95`}
        >
          <span className="material-symbols-outlined text-base">delete_forever</span>
          {isResetting ? 'Executando Reset...' : 'Zerar Banco de Dados BI'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Usuários Ativos" value={users.length} icon="group" color="text-primary" onClick={() => onNavigate?.('players')} />
        <KPICard label="Ativos 7d" value={displayAnalytics.activeUsers} icon="trending_up" color="text-tertiary" onClick={() => onNavigate?.('players')} />
        <KPICard label="Arquivos Áudio" value={audios.length} icon="library_music" color="text-secondary" onClick={() => onNavigate?.('intel', { intelSubTab: 'acervo' })} />
        <KPICard
          label="Eventos Play"
          value={aggregatedData?.totalPlays ?? playEvents.length}
          icon="play_circle"
          color="text-primary"
          onClick={() => onNavigate?.('dashboard', { scrollTo: 'admin-analytics' })}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ClickableSection onClick={() => onNavigate?.('intel', { intelSubTab: 'acervo' })} className="bg-surface-container-low border border-primary/10 p-6 shadow-xl group hover:border-primary/20 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary text-base">cloud_done</span>
              <h3 className="text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver/40">Armazenamento Firebase</h3>
            </div>
            <span className="text-[10px] font-display font-bold text-industrial-silver/60">{(analytics.totalStorageSize / (1024 * 1024)).toFixed(1)} MB / 5 GB</span>
          </div>
          <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
            <div className="h-full bg-secondary shadow-[0_0_10px_rgba(198,198,198,0.2)] transition-all duration-1000" style={{ width: `${Math.min(analytics.storagePercentage, 100)}%` }} />
          </div>
        </ClickableSection>

        <section className="bg-surface-container-low border border-primary/10 p-6 shadow-xl group hover:border-primary/20 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-base">check_circle</span>
              <h3 className="text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver/40">Taxa de Conclusão</h3>
            </div>
            <span className="text-[10px] font-display font-bold text-industrial-silver/60">{displayAnalytics.completionRate.toFixed(1)}% Concluído</span>
          </div>
          <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
            <div className="h-full bg-primary shadow-[0_0_10px_rgba(255,140,0,0.2)] transition-all duration-1000" style={{ width: `${displayAnalytics.completionRate}%` }} />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="bg-surface-container-low border border-primary/10 p-6 shadow-xl lg:col-span-2">
          <div className="flex items-center gap-3 mb-8">
            <span className="material-symbols-outlined text-primary text-base">timeline</span>
            <h3 className="text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver/40">Atividade Temporal (30d)</h3>
          </div>
          <div className="flex items-end gap-1 h-40">
            {displayAnalytics.dailyPlaysSorted.map(([date, count]: [string, any]) => (
              <div key={date} className="flex-1 flex flex-col items-center group relative">
                <div className="absolute -top-10 bg-surface-container-high border border-primary/20 text-primary text-[9px] font-display font-bold px-3 py-1.5 rounded-sm opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-20 shadow-2xl scale-90 group-hover:scale-100 translate-y-2 group-hover:translate-y-0">
                  {date.split('-').slice(1).reverse().join('/')} : {count} plays
                </div>
                <div className="w-full bg-primary/20 group-hover:bg-primary transition-all rounded-t-sm" style={{ height: `${(count / displayAnalytics.maxDailyPlays) * 100}%`, minHeight: count > 0 ? '4px' : '1px' }}></div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4 text-[9px] font-display font-bold text-industrial-silver/20 tracking-widest uppercase border-t border-white/5 pt-4">
            <span>{displayAnalytics.dailyPlaysSorted[0]?.[0] || '---'}</span>
            <span>{displayAnalytics.dailyPlaysSorted[displayAnalytics.dailyPlaysSorted.length - 1]?.[0] || '---'}</span>
          </div>
        </section>

        <section className="bg-surface-container-low border border-primary/10 p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-8">
            <span className="material-symbols-outlined text-primary text-base">schedule</span>
            <h3 className="text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver/40">Horários de Pico</h3>
          </div>
          <div className="grid grid-cols-6 gap-3">
            {analytics.peakHours.map(({ hour, count }) => (
              <div key={hour} className="flex flex-col items-center group relative">
                <div className="absolute -top-10 bg-surface-container-high border border-primary/20 text-primary text-[9px] font-display font-bold px-3 py-1.5 rounded-sm opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-20 shadow-2xl scale-90 group-hover:scale-100">
                  {hour}h: {count} eventos
                </div>
                <div className="w-full aspect-square rounded-sm border border-white/5 transition-all group-hover:scale-110 group-hover:border-primary/40 shadow-inner" style={{ backgroundColor: count === 0 ? 'rgba(255,255,255,0.02)' : `rgba(255, 183, 125, ${0.1 + (count / analytics.maxHourCount) * 0.9})`, boxShadow: count > 0 ? `0 0 15px rgba(255, 183, 125, ${(count / analytics.maxHourCount) * 0.3})` : 'none' }} />
                <span className="text-[8px] text-industrial-silver/20 mt-2 font-display font-bold">{hour}h</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClickableSection onClick={() => onNavigate?.('intel', { intelSubTab: 'acervo' })} className="bg-surface-container-low border border-primary/10 p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-8">
            <span className="material-symbols-outlined text-primary text-base">leaderboard</span>
            <h3 className="text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver/40">Top Conteúdo (Plays)</h3>
          </div>
          <div className="space-y-5">
            {displayAnalytics.mostPlayed.length === 0 ? (<p className="text-industrial-silver/20 text-[10px] font-display font-bold uppercase tracking-widest py-8 text-center border border-dashed border-white/5 rounded-sm">Sem dados registrados</p>) : (
              displayAnalytics.mostPlayed.map(([tapeId, count]: [string, any], idx: number) => {
                const maxCount = displayAnalytics.mostPlayed[0][1] as number;
                const intel = intelRegistry.get(tapeId);
                const remoteTape = audios.find((a) => a.id === tapeId);
                const tapeName = intel?.title || remoteTape?.title || remoteTape?.originalName || tapeId;
                return (
                  <div key={tapeId} className="flex items-center gap-4 group">
                    <span className={`font-display font-bold text-xs w-6 text-right ${idx < 3 ? 'text-primary' : 'text-industrial-silver/20'}`}>0{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-display font-bold text-industrial-silver/80 truncate uppercase tracking-wider group-hover:text-primary transition-colors">{tapeName}</span>
                        <span className="text-[10px] font-display font-bold text-primary ml-2">{count}×</span>
                      </div>
                      <div className="h-1.5 w-full bg-black/40 rounded-full border border-white/5 overflow-hidden">
                        <div className="h-full bg-primary/40 group-hover:bg-primary transition-all" style={{ width: `${(count / maxCount) * 100}%` }}></div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ClickableSection>

        <ClickableSection onClick={() => onNavigate?.('players')} className="bg-surface-container-low border border-primary/10 p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-8">
            <span className="material-symbols-outlined text-primary text-base">person_play</span>
            <h3 className="text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver/40">Agentes Mais Ativos</h3>
          </div>
          <div className="space-y-5">
            {analytics.mostActiveUsers.length === 0 ? (<p className="text-industrial-silver/20 text-[10px] font-display font-bold uppercase tracking-widest py-8 text-center border border-dashed border-white/5 rounded-sm">Sem dados registrados</p>) : (
              analytics.mostActiveUsers.map((user, idx) => {
                const maxCount = analytics.mostActiveUsers[0].count;
                return (
                  <div key={user.uid} className="flex items-center gap-4 group">
                    <div className={`w-10 h-10 border flex items-center justify-center text-[10px] font-display font-bold transition-all rounded-sm ${idx < 3 ? 'border-primary bg-primary/10 text-primary shadow-[0_0_10px_rgba(255,140,0,0.1)]' : 'border-white/5 bg-black/20 text-industrial-silver/20 group-hover:border-white/20'}`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-display font-bold text-industrial-silver/80 truncate uppercase tracking-wider group-hover:text-primary transition-colors">{user.name}</span>
                        <span className="text-[10px] font-display font-bold text-tertiary ml-2">{user.count} plays</span>
                      </div>
                      <div className="h-1.5 w-full bg-black/40 rounded-full border border-white/5 overflow-hidden">
                        <div className="h-full bg-tertiary/40 group-hover:bg-tertiary transition-all" style={{ width: `${(user.count / maxCount) * 100}%` }}></div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ClickableSection>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClickableSection onClick={() => onNavigate?.('intel', { intelSubTab: 'conquistas' })} className="bg-surface-container-low border border-primary/10 p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-8">
            <span className="material-symbols-outlined text-primary text-base">stars</span>
            <h3 className="text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver/40">Conquistas de Alta Raridade</h3>
          </div>
          <div className="space-y-6">
            {analytics.rarityList.slice(0, 5).map((ach) => (
              <div key={ach.id} className="flex items-center gap-4 group">
                <div className="text-2xl w-12 h-12 bg-black/40 border border-white/5 flex items-center justify-center shrink-0 group-hover:border-primary/30 transition-all rounded-sm shadow-inner group-hover:scale-110">
                  {ach.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-[11px] font-display font-bold text-industrial-silver/80 truncate uppercase tracking-tight group-hover:text-primary transition-colors">{ach.title}</h4>
                    <span className="text-[9px] font-display font-bold px-2 py-0.5 bg-primary/5 text-primary/60 border border-primary/10 rounded-sm">{ach.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-1 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-primary/40 group-hover:bg-primary transition-all" style={{ width: `${ach.percentage}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ClickableSection>

        <div className="space-y-6">
          <ClickableSection onClick={() => onNavigate?.('players')} className="bg-surface-container-low border border-primary/10 p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-8">
              <span className="material-symbols-outlined text-primary text-base">group_add</span>
              <h3 className="text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver/40">Crescimento de Rede (Semanal)</h3>
            </div>
            {analytics.weeklyGrowth.size === 0 ? (<p className="text-industrial-silver/20 text-[10px] font-display font-bold uppercase tracking-widest py-8 text-center">Sem registros</p>) : (
              <div className="flex items-end gap-2 h-24">
                {Array.from(analytics.weeklyGrowth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([week, count]) => {
                  const maxWeekly = Math.max(...analytics.weeklyGrowth.values(), 1);
                  return (
                    <div key={week} className="flex-1 flex flex-col items-center group relative">
                      <div className="absolute -top-10 bg-surface-container-high border border-primary/20 text-secondary text-[9px] font-display font-bold px-3 py-1.5 rounded-sm opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-20 shadow-2xl">
                        Semana {week.slice(5)}: +{count} agentes
                      </div>
                      <div className="w-full bg-secondary/20 group-hover:bg-secondary transition-all rounded-t-sm" style={{ height: `${((count as number) / maxWeekly) * 100}%`, minHeight: '4px' }}></div>
                    </div>
                  );
                })}
              </div>
            )}
          </ClickableSection>

          <section className="bg-surface-container-low border border-primary/10 p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-primary text-base">analytics</span>
              <h3 className="text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver/40">Métricas de Engajamento</h3>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              <MetricRow label="Média de Plays" value={users.length > 0 ? ((aggregatedData?.totalPlays ?? playEvents.length) / users.length).toFixed(1) : '0'} />
              <MetricRow label="Conteúdos Únicos" value={new Set([...playEvents.map(e => e.tapeId), ...Object.keys(aggregatedData?.tapePlayCount || {})]).size.toString()} />
              <MetricRow label="Tempo de Escuta" value={formatSecs(displayAnalytics.totalListenSecs)} />
              <MetricRow label="Taxa de Abandono" value={`${displayAnalytics.abandonRate.toFixed(1)}%`} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function KPICard({
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
  const className = `bg-surface-container-low border border-primary/10 p-5 shadow-xl relative overflow-hidden group transition-all ${
    onClick ? 'cursor-pointer hover:border-primary/40 active:scale-[0.98]' : 'hover:border-primary/30'
  }`;

  const content = (
    <>
      {onClick && (
        <span className="absolute top-3 right-3 material-symbols-outlined text-sm text-primary/0 group-hover:text-primary/50 transition-all z-20">
          arrow_forward
        </span>
      )}
      <div className="flex items-center justify-between relative z-10">
        <div>
          <p className="text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver/40 mb-2">{label.replace('_', ' ')}</p>
          <p className={`text-3xl font-display font-bold tracking-tighter ${color}`}>{value}</p>
        </div>
        <div className="w-12 h-12 bg-black/20 rounded-sm flex items-center justify-center border border-white/5 group-hover:border-primary/20 transition-all">
          <span className={`material-symbols-outlined text-2xl opacity-40 group-hover:opacity-100 transition-all ${color}`}>{icon}</span>
        </div>
      </div>
      <div className="absolute -bottom-1 -right-1 w-16 h-16 bg-white/5 rounded-full blur-2xl group-hover:bg-primary/5 transition-all" />
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

function ClickableSection({
  onClick,
  className,
  children,
}: {
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  if (!onClick) {
    return <section className={className}>{children}</section>;
  }

  return (
    <button type="button" onClick={onClick} className={`${className} text-left w-full cursor-pointer hover:border-primary/40 active:scale-[0.99] transition-all`}>
      {children}
    </button>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-white/5 pb-3">
      <span className="text-[9px] font-display font-bold uppercase tracking-widest text-industrial-silver/30">{label}</span>
      <span className="text-sm font-display font-bold text-white tracking-widest">{value}</span>
    </div>
  );
}

function formatSecs(secs: number) {
  if (!secs) return '0s';
  if (secs < 60) return `${Math.floor(secs)}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${(mins / 60).toFixed(1)}h`;
}
