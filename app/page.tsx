'use client'

import { useState } from 'react'
import VideoList from '@/components/VideoList'
import AnalysisSection from '@/components/AnalysisSection'
import type { CheckVideosResponse } from '@/lib/types'

export default function Home() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CheckVideosResponse | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)

  const handleCheckVideos = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: 10 }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data: CheckVideosResponse = await response.json()
      setResult(data)

      // Trigger video list refresh
      setRefreshKey(prev => prev + 1)
    } catch (err) {
      setError((err as Error).message)
      console.error('Failed to check videos:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectVideo = (videoId: string) => {
    setSelectedVideoId(videoId)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            YouTube Transcript Automation
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            One-button transcription for your YouTube channel
          </p>
        </header>

        {/* Primary CTA */}
        <div className="mb-8 text-center">
          <button
            onClick={handleCheckVideos}
            disabled={loading}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                       text-white font-semibold rounded-lg shadow-lg
                       transition-all duration-200 transform hover:scale-105
                       disabled:cursor-not-allowed disabled:transform-none
                       focus:outline-none focus:ring-4 focus:ring-blue-300"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
                Fetching...
              </span>
            ) : (
              'Fetch Recent Videos'
            )}
          </button>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200 font-medium">Error: {error}</p>
          </div>
        )}

        {result && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-green-800 dark:text-green-200 font-medium">
              {result.message}
            </p>
          </div>
        )}

        {/* Selected Video Analysis */}
        {selectedVideoId && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              AI Analysis
            </h2>
            <AnalysisSection videoId={selectedVideoId} />
          </div>
        )}

        {/* Recent Videos List */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Recent Videos
          </h2>
          <VideoList
            refreshKey={refreshKey}
            onSelectVideo={handleSelectVideo}
            selectedVideoId={selectedVideoId}
          />
        </div>
      </div>
    </div>
  )
}
