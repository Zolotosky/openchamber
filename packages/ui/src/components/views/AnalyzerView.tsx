import React, { useEffect, useState, useMemo } from 'react'
import { cn } from '@/lib/utils'

const API = 'http://192.168.0.176:8086'

interface Overview { total_sessions:number; total_cost:number; total_tokens:number; active_agents:number; avg_response_time:number; today_sessions:number; today_cost:number }
interface Agent { name:string; display:string; emoji:string; color:string; model:string; sessions:number; tokens:number; cost:number; last_active:string }
interface Session { session_id:string; title?:string; routes?:any[]; route_count?:number; total_child_tokens?:number; agents:Agent[]; models:string; messages:number; tokens:number; cost:number; started_at:string; ended_at:string }
interface RouteFlow { from:Agent; to:Agent; count:number; avg_duration:number|null; total_tokens:number; total_cost:number }
interface Route { id:number; from_agent:Agent|string; to_agent:Agent|string; task_type:string; model:string; tokens:number; duration_ms:number; status:string; created_at:string; request_summary:string }
interface Step { step:number; from_agent:Agent; to_agent:Agent; task_type:string; task_summary?:string; model:string; tokens:number; tokens_in:number; tokens_out:number; duration_ms:number; status:string; cost:number; created_at:string }
interface Budget { plan:string; premium_total:number; premium_used:number; premium_remaining:number; last_updated:string; ccusage:{total_cost:number;total_tokens:number}; ccusage_live:{totals:{totalCost:number;totalTokens:number;cacheReadTokens:number}} }
interface MemoryStats { total:number; categories:{category:string;count:number;avg_importance:number}[] }
interface DailyStats { date:string; sessions:number; tokens:number; cost:number; agents:string[] }

const fmtTokens = (n:number) => n>=1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n>=1_000 ? `${(n/1_000).toFixed(0)}K` : String(n||0)
const fmtDuration = (ms:number) => {
  if (!ms) return '-'
  const s = Math.round(ms/1000)
  if (s < 60) return `${s}с`
  return `${Math.floor(s/60)}м ${s%60}с`
}
const fmtDate = (s:string) => { try { return new Date(s).toLocaleString('ru-RU',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) } catch { return s } }
const fmtTime = (s:string) => { try { return new Date(s).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) } catch { return s } }

function StatCard({label,value,sub}:{label:string;value:string;sub?:string}) {
  return <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p>{sub&&<p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}</div>
}
function AgentBadge({agent}:{agent:Agent}) {
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white shadow-sm" style={{backgroundColor:agent.color}}>{agent.emoji} {agent.display}</span>
}

function PipelineGraph({ steps, session }: { steps: Step[], session: Session }) {
  const width = 700
  // Identify agents
  const agentsMap = useMemo(() => {
    const map = new Map<string, Agent>()
    // Always include user and aiko
    map.set('user', {name:'user', display:'Ты', emoji:'👤', color:'#9CA3AF'} as Agent)
    map.set('aiko', {name:'aiko', display:'Aiko', emoji:'💖', color:'#EC4899'} as Agent)
    
    steps.forEach(s => {
      if (s.to_agent?.name && s.to_agent.name !== 'user' && s.to_agent.name !== 'aiko') {
        map.set(s.to_agent.name, s.to_agent)
      }
    })
    return map
  }, [steps])

  const childAgents = Array.from(agentsMap.values()).filter(a => a.name !== 'user' && a.name !== 'aiko')
  const height = Math.max(160, 80 + childAgents.length * 80)
  
  // Positions
  const pos = (name: string) => {
    if (name === 'user') return { x: 50, y: height/2 }
    if (name === 'aiko') return { x: 200, y: height/2 }
    // Children stacked on right
    const idx = childAgents.findIndex(a => a.name === name)
    if (idx !== -1) {
       return { x: 500, y: 80 + idx * 80 }
    }
    return { x: 0, y: 0 }
  }

  return (
    <div className="rounded-xl border bg-card p-6 overflow-hidden bg-gradient-to-br from-background to-muted/20">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
          </marker>
        </defs>

        {/* Links */}
        {/* User -> Aiko (if this is initiated by user) */}
        <g className="text-slate-400">
           <path d={`M 110 ${height/2} L 140 ${height/2}`} stroke="currentColor" strokeWidth="2" markerEnd="url(#arrowhead)" />
        </g>

        {steps.map((step, i) => {
          // Visualizing routes from Aiko to others mostly
          // Or from step.from -> step.to
          let fromP = pos(step.from_agent?.name || 'aiko')
          let toP = pos(step.to_agent?.name || 'unknown')
          
          // Adjust for node width (approx)
          const fromX = fromP.x + 60
          const toX = toP.x - 60
          
          if (fromX >= toX) return null // Skip backward links or self-loops for simple visualization

          const midX = (fromX + toX) / 2
          const path = `M ${fromX} ${fromP.y} C ${midX} ${fromP.y}, ${midX} ${toP.y}, ${toX} ${toP.y}`
          
          const color = step.to_agent?.color || '#888'
          const strokeWidth = Math.max(1.5, Math.min(6, step.tokens / 500000))
          
          return (
            <g key={i} className="group hover:opacity-100 opacity-80 transition-opacity duration-300">
              <path 
                d={path} 
                fill="none" 
                stroke={color} 
                strokeWidth={strokeWidth}
                className="transition-all duration-500"
                strokeDasharray="4 2"
              >
                <animate attributeName="stroke-dashoffset" from="100" to="0" dur="2s" repeatCount="indefinite" />
              </path>
              <polygon points="0 0, 10 3.5, 0 7" fill={color} transform={`translate(${toX-5}, ${toP.y-3.5})`}/>
              
              <rect 
                x={(fromX + toX)/2 - 35} 
                y={(fromP.y + toP.y)/2 - 10} 
                width="70" height="20" 
                rx="4" fill="var(--background)" 
                stroke={color} strokeWidth="1"
                className="opacity-90"
              />
              <text 
                x={(fromX + toX)/2} 
                y={(fromP.y + toP.y)/2} 
                dy="4"
                textAnchor="middle" 
                className="text-[10px] fill-foreground font-mono font-medium"
              >
                {fmtTokens(step.tokens)} · {fmtDuration(step.duration_ms)}
              </text>
            </g>
          )
        })}

        {/* Nodes */}
        {[agentsMap.get('user')!, agentsMap.get('aiko')!, ...childAgents].map(agent => {
          const p = pos(agent.name)
          return (
            <g key={agent.name} transform={`translate(${p.x}, ${p.y})`}>
              <rect 
                x="-60" y="-25" width="120" height="50" rx="10" 
                fill={agent.color} fillOpacity="0.15" 
                stroke={agent.color} strokeWidth="2"
                className="shadow-sm"
              />
              <text y="5" textAnchor="middle" className="text-2xl select-none" style={{textShadow:'0 2px 10px rgba(0,0,0,0.1)'}}>{agent.emoji}</text>
              <text y="38" textAnchor="middle" className="text-[10px] uppercase font-bold tracking-wider fill-foreground opacity-70">{agent.display}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function AnalyzerView() {
  const [tab,setTab] = useState<'team'|'controllers'|'routes'|'budget'>('team')
  const [overview,setOverview] = useState<Overview|null>(null)
  const [agents,setAgents] = useState<Agent[]>([])
  const [sessions,setSessions] = useState<Session[]>([])
  const [flow,setFlow] = useState<RouteFlow[]>([])
  const [routes,setRoutes] = useState<Route[]>([])
  const [budget,setBudget] = useState<Budget|null>(null)
  const [memory,setMemory] = useState<MemoryStats|null>(null)
  const [daily,setDaily] = useState<DailyStats[]>([])
  const [loading,setLoading] = useState(true)

  // New state
  const [selectedSessionId, setSelectedSessionId] = useState<string|null>(null)
  const [sessionSteps, setSessionSteps] = useState<Step[]>([])
  const [loadingSteps, setLoadingSteps] = useState(false)

  const fetchAll = async()=>{
    try {
      const [ov,ag,ss,fl,rt,bg,mm,dy] = await Promise.all([
        fetch(`${API}/api/stats/overview`).then(r=>r.json()),
        fetch(`${API}/api/stats/agents`).then(r=>r.json()),
        fetch(`${API}/api/sessions?limit=20`).then(r=>r.json()),
        fetch(`${API}/api/routes/flow`).then(r=>r.json()),
        fetch(`${API}/api/routes?limit=50`).then(r=>r.json()),
        fetch(`${API}/api/budget`).then(r=>r.json()),
        fetch(`${API}/api/memory/stats`).then(r=>r.json()),
        fetch(`${API}/api/stats/daily?days=7`).then(r=>r.json()),
      ])
      setOverview(ov)
      setAgents(Array.isArray(ag)?ag:[])
      setSessions(Array.isArray(ss)?ss:[])
      setFlow(Array.isArray(fl)?fl:[])
      setRoutes(Array.isArray(rt)?rt:[])
      setBudget(bg)
      setMemory(mm)
      setDaily(Array.isArray(dy)?dy:[])
    } catch(e){console.error('Analyzer fetch error:',e)}
    finally{setLoading(false)}
  }

  useEffect(()=>{
    fetchAll()
    const iv=setInterval(fetchAll,30_000)
    return()=>clearInterval(iv)
  },[])

  useEffect(() => {
    if (!selectedSessionId) {
      setSessionSteps([])
      return
    }
    setLoadingSteps(true)
    fetch(`${API}/api/sessions/${selectedSessionId}/steps`)
      .then(r => r.json())
      .then(data => setSessionSteps(Array.isArray(data) ? data : []))
      .catch(e => console.error(e))
      .finally(() => setLoadingSteps(false))
  }, [selectedSessionId])

  const tabs=[{id:'team',label:'Команда'},{id:'controllers',label:'Контроллеры'},{id:'routes',label:'Маршруты'},{id:'budget',label:'Бюджет'}] as const

  return (
    <div className="flex h-full flex-col overflow-auto bg-background">
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div><h1 className="text-lg font-semibold">Pipeline Analyzer</h1><p className="text-sm text-muted-foreground">Agent delegation routes · live monitoring</p></div>
          <div className="flex gap-1 rounded-lg border bg-muted p-1">
            {tabs.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} className={cn('rounded-md px-4 py-1.5 text-sm font-medium transition-colors',tab===t.id?'bg-background shadow-sm':'text-muted-foreground hover:text-foreground')}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">Загружаю данные...</div>
      ) : (
        <div className="flex-1 overflow-auto p-6">

          {tab==='team'&&(
            <div className="space-y-6">
              {overview&&(
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label="Всего сессий" value={String(overview.total_sessions)} sub={`сегодня: ${overview.today_sessions}`}/>
                  <StatCard label="Потрачено $" value={`$${(overview.total_cost??0).toFixed(2)}`} sub={`сегодня: $${(overview.today_cost??0).toFixed(4)}`}/>
                  <StatCard label="Токенов" value={fmtTokens(overview.total_tokens)}/>
                  <StatCard label="Активных агентов" value={String(overview.active_agents)}/>
                </div>
              )}
              <div>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Агенты</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {agents.filter(a=>a.name!=='system').map(a=>(
                    <div key={a.name} className="rounded-xl border bg-card p-4" style={{borderLeftColor:a.color,borderLeftWidth:3}}>
                      <div className="flex items-center gap-2 mb-3"><span className="text-xl">{a.emoji}</span><div><p className="font-semibold text-sm">{a.display}</p><p className="text-xs text-muted-foreground">{a.model}</p></div></div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between"><span>Сессий</span><span className="font-medium text-foreground">{a.sessions}</span></div>
                        <div className="flex justify-between"><span>Токены</span><span className="font-medium text-foreground">{fmtTokens(a.tokens)}</span></div>
                        <div className="flex justify-between"><span>Активен</span><span className="font-medium text-foreground">{fmtDate(a.last_active)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab==='controllers'&&(
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 mb-3"><span className="text-2xl">🛡️</span><div><p className="font-semibold">Мира</p><p className="text-xs text-muted-foreground">Контроллер маршрутов</p></div></div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Маршрутов</span><span className="font-medium">{routes.length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Статус</span><span className="text-green-600 font-medium">Активна</span></div>
                  <p className="text-xs text-muted-foreground pt-2">Логирование маршрутов активировано. Данные накапливаются.</p>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 mb-3"><span className="text-2xl">🔍</span><div><p className="font-semibold">Кей</p><p className="text-xs text-muted-foreground">Скаут памяти</p></div></div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Фактов</span><span className="font-medium">{memory?.total??0}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Категорий</span><span className="font-medium">{memory?.categories.length??0}</span></div>
                </div>
                {memory&&<div className="mt-3 space-y-1">{memory.categories.slice(0,5).map(c=>(
                  <div key={c.category} className="flex items-center gap-2 text-xs">
                    <div className="h-1.5 rounded-full bg-orange-400" style={{width:`${Math.max(4,Math.min(100,(c.count/memory.total)*100))}%`}}/>
                    <span className="text-muted-foreground">{c.category}</span><span className="ml-auto font-medium">{c.count}</span>
                  </div>
                ))}</div>}
              </div>
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 mb-3"><span className="text-2xl">🌐</span><div><p className="font-semibold">Нова</p><p className="text-xs text-muted-foreground">Исследователь</p></div></div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Модель</span><span className="font-medium">Gemini Flash</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Статус</span><span className="text-green-600 font-medium">Готова</span></div>
                </div>
              </div>
            </div>
          )}

          {tab==='routes'&&(
            <div className="space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">История задач</h2>
              
              {sessions.map(s => {
                const isExpanded = selectedSessionId === s.session_id
                const hasRoutes = (s.routes && s.routes.length > 0) || (s.route_count && s.route_count > 0)
                
                return (
                  <div key={s.session_id} className={cn("rounded-xl border bg-card transition-all duration-300", isExpanded ? "ring-2 ring-primary/20 shadow-lg" : "hover:border-primary/50")}>
                    
                    {/* Card Header - Click to Expand */}
                    <div 
                      onClick={() => setSelectedSessionId(isExpanded ? null : s.session_id)}
                      className="p-4 cursor-pointer flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between select-none"
                    >
                      <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2 mb-1">
                           <span className={cn("text-lg font-semibold truncate", !hasRoutes && "text-muted-foreground font-normal")}>
                             {hasRoutes ? "📋 " + (s.title || "Без названия") : "💬 Прямая сессия (без делегации)"}
                           </span>
                           <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                             {fmtDate(s.started_at)}
                           </span>
                         </div>
                         
                         <div className="flex items-center gap-4 text-sm text-muted-foreground">
                           <div className="flex items-center gap-1">
                             <span className="text-primary font-medium">{s.agents?.find(a=>a.name==='aiko')?.emoji || '💖'} Айко</span>
                             <span>→</span>
                             {hasRoutes ? (
                               <div className="flex -space-x-1">
                                 {(s.agents?.filter(a=>a.name!=='aiko' && a.name!=='user') || []).map(a => (
                                   <span key={a.name} title={a.display} className="relative z-10">{a.emoji}</span>
                                 ))}
                                 <span className="ml-2 text-xs">({s.route_count || 0} маршрутов)</span>
                               </div>
                             ) : (
                               <span>Нет делегации</span>
                             )}
                           </div>
                           
                           <div className="hidden sm:flex items-center gap-3 ml-auto">
                              <span className="bg-muted px-2 py-0.5 rounded text-xs font-mono">{fmtTokens(s.total_child_tokens || s.tokens)} токены</span>
                              {s.ended_at && s.started_at && (
                                <span className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                                  {Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime())/1000/60)}м {Math.round(((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime())/1000)%60)}с
                                </span>
                              )}
                           </div>
                         </div>
                      </div>
                      
                      <div className="text-muted-foreground sm:ml-4 self-start sm:self-center">
                        {isExpanded ? '▼' : '▶'}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t bg-muted/10 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        {loadingSteps ? (
                           <div className="py-8 text-center text-muted-foreground animate-pulse">Загрузка деталей маршрута...</div>
                        ) : (
                           <div className="grid lg:grid-cols-2 gap-6">
                              {/* Left: Steps Table */}
                              <div className="space-y-2">
                                <h3 className="text-xs font-semibold uppercase text-muted-foreground">Хронология выполнения</h3>
                                <div className="rounded-lg border bg-background overflow-hidden">
                                   <table className="w-full text-xs">
                                     <thead className="bg-muted/50">
                                       <tr>
                                         <th className="p-2 text-left">#</th>
                                         <th className="p-2 text-left">От → Кому</th>
                                         <th className="p-2 text-left">Описание</th>
                                         <th className="p-2 text-right">Токены</th>
                                         <th className="p-2 text-right">Время</th>
                                       </tr>
                                     </thead>
                                     <tbody className="divide-y">
                                       {sessionSteps.map((step, idx) => (
                                         <tr key={idx} className="hover:bg-muted/20">
                                           <td className="p-2 text-muted-foreground font-mono">{idx + 1}</td>
                                           <td className="p-2 whitespace-nowrap">
                                             <span style={{color: step.from_agent?.color}}>{step.from_agent?.display}</span>
                                             <span className="text-muted-foreground mx-1">→</span>
                                             <span style={{color: step.to_agent?.color}}>{step.to_agent?.display}</span>
                                           </td>
                                           <td className="p-2 max-w-[150px] truncate" title={step.task_summary || step.task_type}>
                                             {step.task_summary || step.task_type}
                                           </td>
                                           <td className="p-2 text-right font-mono text-muted-foreground">{fmtTokens(step.tokens)}</td>
                                           <td className="p-2 text-right text-muted-foreground">{fmtDuration(step.duration_ms)}</td>
                                         </tr>
                                       ))}
                                       {sessionSteps.length === 0 && (
                                         <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Нет записей о шагах</td></tr>
                                       )}
                                     </tbody>
                                   </table>
                                </div>
                              </div>

                              {/* Right: Visualization */}
                              <div className="space-y-2">
                                <h3 className="text-xs font-semibold uppercase text-muted-foreground">Карта делегирования</h3>
                                {sessionSteps.length > 0 ? (
                                  <PipelineGraph steps={sessionSteps} session={s} />
                                ) : (
                                  <div className="h-[200px] rounded-xl border border-dashed flex items-center justify-center text-muted-foreground text-xs">
                                    Нет данных для визуализации
                                  </div>
                                )}
                              </div>
                           </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {tab==='budget'&&budget&&(
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard label="Потрачено (ccusage)" value={`$${(budget.ccusage?.total_cost??0).toFixed(4)}`}/>
                <StatCard label="Токенов" value={fmtTokens(budget.ccusage_live?.totals?.totalTokens??0)}/>
                <StatCard label="Cache hit rate" value={`${budget.ccusage_live?.totals?((budget.ccusage_live.totals.cacheReadTokens/(budget.ccusage_live.totals.totalTokens||1))*100).toFixed(1):0}%`}/>
              </div>
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between mb-3"><p className="font-semibold">GitHub Copilot Pro+</p><span className="text-xs text-muted-foreground">Обновлено: {budget.last_updated}</span></div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Premium Interactions</span><span className="font-medium">{budget.premium_used} / {budget.premium_total}</span></div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-green-500 transition-all" style={{width:`${Math.min(100,(budget.premium_used/budget.premium_total)*100)}%`}}/></div>
                  <p className="text-xs text-muted-foreground">Осталось: {budget.premium_remaining}</p>
                </div>
              </div>
              {daily.length>0&&(
                <div>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">По дням</h2>
                  <div className="rounded-xl border overflow-hidden">
                    <table className="w-full text-sm"><thead className="bg-muted/50"><tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Дата</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Сессий</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Токены</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Агенты</th>
                    </tr></thead><tbody className="divide-y">
                      {daily.map(d=>(
                        <tr key={d.date} className="hover:bg-muted/30">
                          <td className="px-4 py-2 font-medium">{d.date}</td>
                          <td className="px-4 py-2">{d.sessions}</td>
                          <td className="px-4 py-2">{fmtTokens(d.tokens)}</td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{Array.isArray(d.agents)?d.agents.join(', '):'—'}</td>
                        </tr>
                      ))}
                    </tbody></table>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
