'use client'

import { useState } from 'react'
import type { LatestTranscriptResponse } from '@/lib/types'

interface TranscriptCardProps {
  transcript: LatestTranscriptResponse
}

export default function TranscriptCard({ transcript }: TranscriptCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(transcript.transcript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const MAX_PREVIEW_LENGTH = 300
  const transcriptPreview = transcript.transcript.length > MAX_PREVIEW_LENGTH && !expanded
    ? transcript.transcript.substring(0, MAX_PREVIEW_LENGTH) + '...'
    : transcript.transcript

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
          <a
            href={`https://www.youtube.com/watch?v=${transcript.video_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {transcript.title}
          </a>
        </h3>
        <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
          <span>Published: {formatDate(transcript.published_at)}</span>
          <span>•</span>
          <span>{transcript.transcript.length} characters</span>
        </div>
      </div>

      {/* Transcript Content */}
      <div className="p-6">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-slate-700 dark:text-slate-300">Transcript:</h4>
            <button
              onClick={handleCopy}
              className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200
                         dark:bg-slate-700 dark:hover:bg-slate-600
                         text-slate-700 dark:text-slate-300
                         rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 rounded-md p-4 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {transcriptPreview}
            </p>
          </div>
        </div>

        {/* Expand/Collapse Button */}
        {transcript.transcript.length > MAX_PREVIEW_LENGTH && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Footer - Video Link */}
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
        <a
          href={`https://www.youtube.com/watch?v=${transcript.video_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400
                     hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          Watch on YouTube
        </a>
      </div>
    </div>
  )
}
