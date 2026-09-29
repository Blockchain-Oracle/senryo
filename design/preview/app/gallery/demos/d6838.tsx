"use client"

import * as React from "react"
import QRCodeDisplay, { type QRCodeResult } from "@/components/ui/qr-code-generator"

function makePlaceholderDataURL(size: number): string {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, size, size)

  const cell = Math.max(2, Math.floor(size / 28))
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const on = ((x / cell) ^ (y / cell)) % 3 === 0
      if (on) {
        ctx.fillStyle = "#000"
        ctx.fillRect(x, y, cell, cell)
      }
    }
  }
  const marker = (ox: number, oy: number) => {
    ctx.fillStyle = "#000"
    ctx.fillRect(ox, oy, 7 * cell, 7 * cell)
    ctx.fillStyle = "#fff"
    ctx.fillRect(ox + cell, oy + cell, 5 * cell, 5 * cell)
    ctx.fillStyle = "#000"
    ctx.fillRect(ox + 2 * cell, oy + 2 * cell, 3 * cell, 3 * cell)
  }
  marker(cell, cell)
  marker(size - 8 * cell, cell)
  marker(cell, size - 8 * cell)

  return canvas.toDataURL("image/png")
}

export default function Demo() {
  const [qr, setQr] = React.useState<QRCodeResult | null>(null)

  React.useEffect(() => {
    const size = 300
    const output = makePlaceholderDataURL(size)
    setQr({
      data: "https://example.com?utm=demo",
      size,
      output,
    })
  }, [])

  return <QRCodeDisplay data={qr} />
}
