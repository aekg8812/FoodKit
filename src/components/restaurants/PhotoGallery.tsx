'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

export type GalleryImage = {
  key: string   // "r:{main_image_path}" | "rv:{review image_path}"
  url: string   // validated signed URL
  alt: string
}

interface Props {
  images: GalleryImage[]
  restaurantName: string
}

function Placeholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#F3E5D8]">
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#C9A98A"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    </div>
  )
}

export default function PhotoGallery({ images, restaurantName }: Props) {
  const [selectedKey, setSelectedKey] = useState<string>(images[0]?.key ?? '')
  const [erroredKeys, setErroredKeys] = useState<Set<string>>(new Set())
  const thumbsRef = useRef<HTMLDivElement>(null)

  const validImages = images.filter((img) => !erroredKeys.has(img.key))
  const currentImage =
    validImages.find((img) => img.key === selectedKey) ?? validImages[0] ?? null
  const currentIndex = currentImage ? validImages.indexOf(currentImage) : -1

  const handleError = useCallback((key: string) => {
    setErroredKeys((prev) => new Set([...prev, key]))
  }, [])

  const selectAndFocus = useCallback((index: number) => {
    const target = validImages[index]
    if (!target) return
    setSelectedKey(target.key)
    // Move DOM focus to the newly selected tab button
    const btn = thumbsRef.current?.children[index] as HTMLElement | undefined
    btn?.focus()
  }, [validImages])

  // Scroll selected thumbnail into view
  useEffect(() => {
    if (!thumbsRef.current || currentIndex < 0) return
    const thumb = thumbsRef.current.children[currentIndex] as HTMLElement | undefined
    thumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [currentIndex])

  // Keyboard left/right navigation — only when a tab button inside the strip has focus
  const handleTabsKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault()
        selectAndFocus(currentIndex - 1)
      }
      if (e.key === 'ArrowRight' && currentIndex < validImages.length - 1) {
        e.preventDefault()
        selectAndFocus(currentIndex + 1)
      }
    },
    [currentIndex, validImages.length, selectAndFocus],
  )

  return (
    <section aria-label={`${restaurantName}の写真`}>
      {/* Main image */}
      <div
        id="gallery-main"
        role="tabpanel"
        aria-label={currentImage?.alt ?? restaurantName}
        className="relative h-[220px] w-full overflow-hidden bg-[#F3E5D8]"
      >
        {currentImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={currentImage.key}
            src={currentImage.url}
            alt={currentImage.alt}
            className="h-full w-full object-cover"
            onError={() => handleError(currentImage.key)}
          />
        ) : (
          <Placeholder />
        )}

        {/* Photo count badge — shown when 2+ valid images */}
        {validImages.length >= 2 && (
          <div
            className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2.5 py-0.5 text-xs font-medium text-white"
            aria-live="polite"
            aria-atomic="true"
          >
            {currentIndex + 1} / {validImages.length}
          </div>
        )}
      </div>

      {/* Thumbnail strip — only when 2+ valid images */}
      {validImages.length >= 2 && (
        <div
          ref={thumbsRef}
          role="tablist"
          aria-label="写真を選択"
          onKeyDown={handleTabsKeyDown}
          className="flex gap-1.5 overflow-x-auto bg-surface px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {validImages.map((img, i) => (
            <button
              key={img.key}
              role="tab"
              type="button"
              aria-label={`写真${i + 1}を表示`}
              aria-selected={img.key === selectedKey}
              aria-controls="gallery-main"
              // tabIndex pattern for tablist: only selected tab is in tab order
              tabIndex={img.key === selectedKey ? 0 : -1}
              onClick={() => selectAndFocus(i)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-terra focus-visible:ring-offset-1 ${
                img.key === selectedKey
                  ? 'border-terra opacity-100'
                  : 'border-transparent opacity-60 hover:opacity-90'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.alt}
                className="h-full w-full object-cover"
                onError={() => handleError(img.key)}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
