'use client'

import { useState } from 'react'
import type { Analysis } from '@/lib/supabase'

interface AnalysisSectionProps {
  videoId: string | null
}

type AgentType = 'must_roster' | 'watch_list' | 'drop' | 'injury_return'

interface AgentConfig {
  type: AgentType
  label: string
  emoji: string
  color: string
  hoverColor: string
}

const AGENTS: AgentConfig[] = [
  {
    type: 'must_roster',
    label: 'Must Roster',
    emoji: '🔥',
    color: 'bg-red-600',
    hoverColor: 'hover:bg-red-700',
  },
  {
    type: 'watch_list',
    label: 'Watch List',
    emoji: '👀',
    color: 'bg-yellow-600',
    hoverColor: 'hover:bg-yellow-700',
  },
  {
    type: 'drop',
    label: 'Drop Candidates',
    emoji: '❌',
    color: 'bg-gray-600',
    hoverColor: 'hover:bg-gray-700',
  },
  {
    type: 'injury_return',
    label: 'Injury Returns',
    emoji: '🏥',
    color: 'bg-green-600',
    hoverColor: 'hover:bg-green-700',
  },
]

export default function AnalysisSection({ videoId }: AnalysisSectionProps) {
  const [analyses, setAnalyses] = useState<Record<AgentType, Analysis | null>>({
    must_roster: null,
    watch_list: null,
    drop: null,
    injury_return: null,
  })

  const [loading, setLoading] = useState<Record<AgentType, boolean>>({
    must_roster: false,
    watch_list: false,
    drop: false,
    injury_return: false,
  })

  const [errors, setErrors] = useState<Record<AgentType, string | null>>({
    must_roster: null,
    watch_list: null,
    drop: null,
    injury_return: null,
  })

  // Check if any agent is currently running
  const isAnyLoading = Object.values(loading).some(val => val)

  const runAnalysis = async (agentType: AgentType) => {
    if (!videoId) {
      setErrors(prev => ({
        ...prev,
        [agentType]: 'No video selected',
      }))
      return
    }

    setLoading(prev => ({ ...prev, [agentType]: true }))
    setErrors(prev => ({ ...prev, [agentType]: null }))

    try {
      const response = await fetch(`/api/analysis/${videoId}/${agentType}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()

      setAnalyses(prev => ({
        ...prev,
        [agentType]: {
          ...data.analysis,
          video_id: videoId,
          agent_type: agentType,
          id: '', // Will be set by server
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }))
    } catch (err) {
      setErrors(prev => ({
        ...prev,
        [agentType]: (err as Error).message,
      }))
      console.error(`Failed to run ${agentType} analysis:`, err)
    } finally {
      setLoading(prev => ({ ...prev, [agentType]: false }))
    }
  }

  if (!videoId) {
    return (
      <div className="p-8 bg-white dark:bg-slate-800 rounded-lg shadow-md text-center">
        <p className="text-slate-500 dark:text-slate-400">
          Transcribe a video first to enable AI analysis
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Loading Banner */}
      {isAnyLoading && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-400 dark:border-blue-600 rounded-lg">
          <div className="flex items-center justify-center gap-3">
            <svg className="animate-spin h-6 w-6 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="text-blue-800 dark:text-blue-200 font-semibold text-lg">
              AI Analysis in progress... This may take up to 2 minutes
            </p>
          </div>
        </div>
      )}

      {/* Agent Buttons */}
      <div className="grid grid-cols-2 gap-4">
        {AGENTS.map(agent => (
          <button
            key={agent.type}
            onClick={() => runAnalysis(agent.type)}
            disabled={isAnyLoading}
            className={`${agent.color} ${agent.hoverColor}
                       text-white px-6 py-4 rounded-lg font-semibold
                       shadow-md transition-all duration-200
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-4 focus:ring-offset-2
                       relative overflow-hidden`}
          >
            {loading[agent.type] && (
              <div className="absolute inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            )}
            <span className="flex items-center justify-center gap-2">
              <span className="text-2xl">{agent.emoji}</span>
              <span className={loading[agent.type] ? 'opacity-50' : ''}>
                {loading[agent.type] ? 'Analyzing...' : agent.label}
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* Analysis Results */}
      {AGENTS.map(agent => {
        const analysis = analyses[agent.type]
        const error = errors[agent.type]

        if (!analysis && !error) return null

        return (
          <div key={agent.type} className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="text-2xl">{agent.emoji}</span>
                {agent.label}
              </h3>

              <div className="flex items-center gap-3">
                {analysis && (
                  <>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium
                      ${analysis.confidence === 'HIGH' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' : ''}
                      ${analysis.confidence === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' : ''}
                      ${analysis.confidence === 'LOW' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' : ''}
                    `}>
                      {analysis.confidence} Confidence
                    </span>
                    <button
                      onClick={() => runAnalysis(agent.type)}
                      disabled={isAnyLoading}
                      className="px-3 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600
                                 text-slate-700 dark:text-slate-300 rounded text-sm font-medium
                                 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                 flex items-center gap-1"
                      title="Re-run this analysis"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Re-run
                    </button>
                  </>
                )}
                {error && (
                  <button
                    onClick={() => runAnalysis(agent.type)}
                    disabled={isAnyLoading}
                    className="px-3 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50
                               text-red-700 dark:text-red-300 rounded text-sm font-medium
                               transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                               flex items-center gap-1"
                    title="Retry this analysis"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Retry
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-800 dark:text-red-200">Error: {error}</p>
              </div>
            )}

            {analysis && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <p className="text-slate-700 dark:text-slate-300">{analysis.summary}</p>
                </div>

                {/* Players */}
                {analysis.players.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                      Players ({analysis.players.length})
                    </h4>

                    {analysis.players.map((player: any, idx: number) => (
                      <div key={idx} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-bold text-lg text-slate-900 dark:text-slate-100">
                              {player.name}
                            </span>
                            {player.team && (
                              <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                                {player.team}
                              </span>
                            )}
                            {player.position && (
                              <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                                • {player.position}
                              </span>
                            )}
                          </div>

                          <span className={`px-2 py-1 rounded text-xs font-medium
                            ${player.urgency === 'HIGH' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' : ''}
                            ${player.urgency === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' : ''}
                            ${player.urgency === 'LOW' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' : ''}
                          `}>
                            {player.urgency}
                          </span>
                        </div>

                        <p className="text-sm text-slate-600 dark:text-slate-400 italic">
                          "{player.reasoning}"
                        </p>

                        {player.context && (
                          <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
                            {player.context}
                          </p>
                        )}

                        {player.roster_percentage && (
                          <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                            Rostered: {player.roster_percentage}%
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 dark:text-slate-400 text-center py-4">
                    No players found in this category
                  </p>
                )}

                {/* Notes */}
                {analysis.notes && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm">
                    <p className="text-blue-800 dark:text-blue-200">{analysis.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
