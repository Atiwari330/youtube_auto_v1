'use client'

import { useEffect, useState } from 'react'
import type { VideosListResponse } from '@/lib/types'

interface VideoListProps {
  refreshKey?: number
  onSelectVideo?: (videoId: string) => void
  selectedVideoId?: string | null
}

export default function VideoList({ refreshKey, onSelectVideo, selectedVideoId }: VideoListProps) {
  const [videos, setVideos] = useState<VideosListResponse['videos']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [transcribingId, setTranscribingId] = useState<string | null>(null)

  useEffect(() => {
    fetchVideos()
  }, [refreshKey])

  const fetchVideos = async () => {
    try {
      const response = await fetch('/api/videos?limit=10')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data: VideosListResponse = await response.json()
      setVideos(data.videos)
    } catch (err) {
      setError((err as Error).message)
      console.error('Failed to fetch videos:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleTranscribe = async (videoId: string) => {
    setTranscribingId(videoId)

    try {
      const response = await fetch(`/api/transcribe/${videoId}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      // Refresh video list
      await fetchVideos()

      // Auto-select the transcribed video
      if (onSelectVideo) {
        onSelectVideo(videoId)
      }
    } catch (err) {
      console.error('Failed to transcribe video:', err)
      alert(`Failed to transcribe: ${(err as Error).message}`)
    } finally {
      setTranscribingId(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Unknown'

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      succeeded: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800',
      processing: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800',
      failed: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800',
      queued: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
    }

    const style = styles[status as keyof typeof styles] || styles.queued

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded border ${style}`}>
        {status}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 dark:border-slate-700 border-t-blue-600"></div>
        <p className="mt-4 text-slate-600 dark:text-slate-400">Loading videos...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-8 text-center">
        <p className="text-red-600 dark:text-red-400">Failed to load videos: {error}</p>
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-8 text-center">
        <p className="text-slate-500 dark:text-slate-400">No videos processed yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Published
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {videos.map((video) => {
              const isTranscribing = transcribingId === video.id
              const isSelected = selectedVideoId === video.id

              return (
                <tr
                  key={video.id}
                  className={`transition-colors ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <td className="px-6 py-4">
                    <a
                      href={`https://www.youtube.com/watch?v=${video.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      {video.title}
                    </a>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {formatDate(video.published_at)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {formatDuration(video.duration_sec)}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(video.status)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {video.status === 'queued' && (
                        <button
                          onClick={() => handleTranscribe(video.id)}
                          disabled={isTranscribing}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded
                                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isTranscribing ? 'Transcribing...' : 'Transcribe'}
                        </button>
                      )}
                      {video.status === 'processing' && (
                        <span className="px-3 py-1 text-sm text-slate-500 dark:text-slate-400 italic">
                          Processing...
                        </span>
                      )}
                      {video.status === 'succeeded' && onSelectVideo && (
                        <button
                          onClick={() => onSelectVideo(video.id)}
                          className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'View'}
                        </button>
                      )}
                      {video.status === 'failed' && (
                        <button
                          onClick={() => handleTranscribe(video.id)}
                          disabled={isTranscribing}
                          className="px-3 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50
                                     text-red-700 dark:text-red-300 text-sm font-medium rounded
                                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isTranscribing ? 'Retrying...' : 'Retry'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
