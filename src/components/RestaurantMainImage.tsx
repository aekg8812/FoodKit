'use client'

import { useState } from 'react'

function Placeholder({ className }: { className?: string }) {
  return (
    <div className={`flex h-full w-full items-center justify-center bg-[#F3E5D8] ${className ?? ''}`}>
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

type Props = {
  src: string | null
  alt: string
  className?: string
}

export default function RestaurantMainImage({ src, alt, className }: Props) {
  const [errored, setErrored] = useState(false)

  if (!src || errored) {
    return <Placeholder className={className} />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`h-full w-full object-cover ${className ?? ''}`}
      onError={() => setErrored(true)}
    />
  )
}
