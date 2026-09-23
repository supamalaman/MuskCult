import type { MediaAsset } from './types'
import { uid } from './utils'

function loadVideoMeta(url: string, file: File): Promise<MediaAsset> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    const cleanup = () => {
      video.removeAttribute('src')
      video.load()
    }

    video.onloadedmetadata = () => {
      const asset: MediaAsset = {
        id: uid('vid'),
        name: file.name,
        kind: 'video',
        file,
        url,
        duration: video.duration || 0,
        width: video.videoWidth,
        height: video.videoHeight,
      }
      cleanup()
      resolve(asset)
    }
    video.onerror = () => {
      cleanup()
      reject(new Error(`Could not read video: ${file.name}`))
    }
    video.src = url
  })
}

function loadAudioMeta(url: string, file: File): Promise<MediaAsset> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio')
    audio.preload = 'metadata'

    audio.onloadedmetadata = () => {
      resolve({
        id: uid('aud'),
        name: file.name,
        kind: 'audio',
        file,
        url,
        duration: audio.duration || 0,
      })
    }
    audio.onerror = () => reject(new Error(`Could not read audio: ${file.name}`))
    audio.src = url
  })
}

export async function loadMediaFiles(files: FileList | File[]): Promise<{
  videos: MediaAsset[]
  audios: MediaAsset[]
  errors: string[]
}> {
  const videos: MediaAsset[] = []
  const audios: MediaAsset[] = []
  const errors: string[] = []

  for (const file of Array.from(files)) {
    const url = URL.createObjectURL(file)
    try {
      if (file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv)$/i.test(file.name)) {
        videos.push(await loadVideoMeta(url, file))
      } else if (
        file.type.startsWith('audio/') ||
        /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)
      ) {
        audios.push(await loadAudioMeta(url, file))
      } else {
        URL.revokeObjectURL(url)
        errors.push(`Skipped unsupported file: ${file.name}`)
      }
    } catch (e) {
      URL.revokeObjectURL(url)
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }

  return { videos, audios, errors }
}

export function revokeAsset(asset: MediaAsset) {
  URL.revokeObjectURL(asset.url)
}
