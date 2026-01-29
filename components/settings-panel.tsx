"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { User, Settings, TrendingUp, BarChart3, Bell, Wifi, WifiOff, CheckCircle2, XCircle, Camera, X, ZoomIn, ZoomOut } from "lucide-react"
import { triggerHaptic } from "@/lib/haptics"
import { TradeArchivePanel } from "@/components/trade-archive-panel"
import { cn } from "@/lib/utils"

export type SplashStyle = "uppercase" | "lowercase"

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

type SettingsTab = "preferences" | "performance"

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [splashStyle, setSplashStyle] = useState<SplashStyle>("lowercase")
  const [isDragging, setIsDragging] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [activeTab, setActiveTab] = useState<SettingsTab>("performance")
  const [dataSourceStatus, setDataSourceStatus] = useState<"checking" | "live" | "simulated">("checking")
  const [lastChecked, setLastChecked] = useState<string>("")
  const [profilePhoto, setProfilePhoto] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("spx_profile_photo")
    }
    return null
  })
  const [showCropModal, setShowCropModal] = useState(false)
  const [tempImage, setTempImage] = useState<string | null>(null)
  const [cropScale, setCropScale] = useState(1)
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 })
  const [isCropDragging, setIsCropDragging] = useState(false)
  const cropStartPos = useRef({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem("spx_splash_style") as SplashStyle | null
    if (saved) {
      setSplashStyle(saved)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      setDragY(0)
      // Check data source status when panel opens
      checkDataSource()
    }
  }, [isOpen])

  const checkDataSource = async () => {
    setDataSourceStatus("checking")
    try {
      const response = await fetch("/api/market-data?endpoint=quote&symbol=SPX")
      const data = await response.json()
      if (data.source === "tradier") {
        setDataSourceStatus("live")
      } else {
        setDataSourceStatus("simulated")
      }
      setLastChecked(new Date().toLocaleTimeString())
    } catch {
      setDataSourceStatus("simulated")
      setLastChecked(new Date().toLocaleTimeString())
    }
  }

  const handleSplashStyleChange = (style: SplashStyle) => {
    triggerHaptic("light")
    setSplashStyle(style)
    localStorage.setItem("spx_splash_style", style)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const currentY = e.touches[0].clientY
    const diff = currentY - startYRef.current
    if (diff > 0) {
      setDragY(diff)
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    if (dragY > 100) {
      triggerHaptic("light")
      onClose()
    }
    setDragY(0)
  }

  const handleTabChange = (tab: SettingsTab) => {
    triggerHaptic("light")
    setActiveTab(tab)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setTempImage(reader.result as string)
        setShowCropModal(true)
        setCropScale(1)
        setCropPosition({ x: 0, y: 0 })
      }
      reader.readAsDataURL(file)
    }
    if (e.target) e.target.value = ""
  }

  const handleCropDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsCropDragging(true)
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
    cropStartPos.current = { x: clientX - cropPosition.x, y: clientY - cropPosition.y }
  }

  const handleCropDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isCropDragging) return
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
    setCropPosition({
      x: clientX - cropStartPos.current.x,
      y: clientY - cropStartPos.current.y,
    })
  }

  const handleCropDragEnd = () => {
    setIsCropDragging(false)
  }

  const handleSaveCrop = () => {
    if (!tempImage || !canvasRef.current) return

    // Compress and resize the image to fit localStorage limits
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      // Resize to max 300x300 for profile photo
      const maxSize = 300
      let width = img.width
      let height = img.height
      
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width
          width = maxSize
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height
          height = maxSize
        }
      }
      
      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)
      
      // Compress as JPEG with 0.8 quality
      const compressedImage = canvas.toDataURL("image/jpeg", 0.8)
      
      try {
        localStorage.setItem("spx_profile_photo", compressedImage)
        setProfilePhoto(compressedImage)
        setShowCropModal(false)
        setTempImage(null)
        setCropScale(1)
        setCropPosition({ x: 0, y: 0 })
        triggerHaptic("success")
      } catch (e) {
        console.error("Failed to save profile photo:", e)
        // Try with lower quality if storage is full
        const smallerImage = canvas.toDataURL("image/jpeg", 0.5)
        try {
          localStorage.setItem("spx_profile_photo", smallerImage)
          setProfilePhoto(smallerImage)
          setShowCropModal(false)
          setTempImage(null)
          setCropScale(1)
          setCropPosition({ x: 0, y: 0 })
          triggerHaptic("success")
        } catch (e2) {
          console.error("Still failed to save profile photo:", e2)
          triggerHaptic("error")
        }
      }
    }
    img.src = tempImage
  }

  const handleRemovePhoto = () => {
    setProfilePhoto(null)
    localStorage.removeItem("spx_profile_photo")
    triggerHaptic("light")
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9998] flex items-end justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: Math.max(0, 1 - dragY / 200) }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full max-w-lg bg-[#0a0a0a] rounded-t-3xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? "none" : "transform 0.3s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 bg-white/20 rounded-full" />

        <div className="px-5 pt-8 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center">
                <User className="w-5 h-5 text-white/70" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-white">Profile</h2>
                <p className="text-xs text-white/40">Settings & Performance</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {dataSourceStatus === "live" ? (
                <Wifi className="w-4 h-4 text-emerald-500" />
              ) : dataSourceStatus === "simulated" ? (
                <WifiOff className="w-4 h-4 text-yellow-500" />
              ) : (
                <Wifi className="w-4 h-4 text-white/30 animate-pulse" />
              )}
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  dataSourceStatus === "live"
                    ? "bg-emerald-500"
                    : dataSourceStatus === "simulated"
                      ? "bg-yellow-500"
                      : "bg-white/30",
                )}
              />
              <Bell className="w-5 h-5 text-white/30" />
            </div>
          </div>
        </div>

        <div className="px-5 pb-4">
          <div className="flex items-center gap-1 p-1.5 rounded-full bg-black/60 backdrop-blur-xl w-fit mx-auto">
            <button
              onClick={() => handleTabChange("preferences")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm transition-all duration-200 min-h-[44px]",
                activeTab === "preferences"
                  ? "bg-white/15 text-white"
                  : "text-white/50 hover:text-white/70 hover:bg-white/5",
              )}
            >
              <Settings className="w-4 h-4" />
              <span>Preferences</span>
            </button>
            <button
              onClick={() => handleTabChange("performance")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm transition-all duration-200 min-h-[44px]",
                activeTab === "performance"
                  ? "bg-white/15 text-white"
                  : "text-white/50 hover:text-white/70 hover:bg-white/5",
              )}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Performance</span>
            </button>
          </div>
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto px-5 pb-8">
          {activeTab === "preferences" ? (
            <div className="space-y-4">
              {/* Profile Photo Section */}
              <div className="p-4 rounded-2xl bg-black/40">
                <div className="flex items-center gap-2 mb-4">
                  <Camera className="w-4 h-4 text-white/40" />
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">Profile Photo</p>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-white/10">
                      {profilePhoto ? (
                        <img src={profilePhoto || "/placeholder.svg"} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-10 h-10 text-white/30" />
                        </div>
                      )}
                    </div>
                    {profilePhoto && (
                      <button
                        onClick={handleRemovePhoto}
                        className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500/80 flex items-center justify-center hover:bg-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-sm text-white/70 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    {profilePhoto ? "Change Photo" : "Add Photo"}
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                <p className="text-[10px] text-white/20 text-center mt-4">
                  Tap to upload and crop your profile picture
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-black/40">
                <div className="flex items-center gap-2 mb-4">
                  <Wifi className="w-4 h-4 text-white/40" />
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">Data Source</p>
                </div>

                <div
                  className={cn(
                    "p-4 rounded-xl border",
                    dataSourceStatus === "live"
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : dataSourceStatus === "simulated"
                        ? "bg-yellow-500/10 border-yellow-500/30"
                        : "bg-white/5 border-white/10",
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {dataSourceStatus === "live" ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : dataSourceStatus === "simulated" ? (
                        <XCircle className="w-5 h-5 text-yellow-500" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      )}
                      <span className="text-sm font-medium text-white">
                        {dataSourceStatus === "live"
                          ? "Tradier API Connected"
                          : dataSourceStatus === "simulated"
                            ? "Using Simulated Data"
                            : "Checking Connection..."}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-white/50 mb-3">
                    {dataSourceStatus === "live"
                      ? "Receiving live market data from Tradier. Real-time quotes and options data are active."
                      : dataSourceStatus === "simulated"
                        ? "Tradier API not responding. Using simulated data for demonstration."
                        : "Verifying API connection..."}
                  </p>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/30">{lastChecked ? `Last checked: ${lastChecked}` : ""}</span>
                    <button
                      onClick={() => {
                        triggerHaptic("light")
                        checkDataSource()
                      }}
                      className="text-primary hover:text-primary/80 flex items-center gap-1"
                    >
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-white/20 text-center mt-3">
                  API key is configured via environment variables
                </p>
              </div>

              {/* Splash Screen Style */}
              <div className="p-4 rounded-2xl bg-black/40">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="w-4 h-4 text-white/40" />
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">Splash Screen Style</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleSplashStyleChange("uppercase")}
                    className={cn(
                      "relative p-4 rounded-2xl transition-all duration-200 min-h-[100px]",
                      splashStyle === "uppercase"
                        ? "bg-white/5 border-2 border-white/30"
                        : "bg-white/5 border-2 border-transparent hover:bg-white/8",
                    )}
                  >
                    <div className="text-center">
                      <span
                        className="text-lg font-light tracking-wider"
                        style={{
                          background: "linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #3b82f6 100%)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                        }}
                      >
                        SPX.RUN
                      </span>
                      <p className="text-[10px] text-white/30 mt-2 uppercase tracking-wider">Version A</p>
                    </div>
                    {splashStyle === "uppercase" && (
                      <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                  </button>

                  <button
                    onClick={() => handleSplashStyleChange("lowercase")}
                    className={cn(
                      "relative p-4 rounded-2xl transition-all duration-200 min-h-[100px]",
                      splashStyle === "lowercase"
                        ? "bg-white/5 border-2 border-white/30"
                        : "bg-white/5 border-2 border-transparent hover:bg-white/8",
                    )}
                  >
                    <div className="text-center">
                      <span
                        className="text-lg font-extralight tracking-widest"
                        style={{
                          background: "linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #3b82f6 100%)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                        }}
                      >
                        spx.run
                      </span>
                      <p className="text-[10px] text-white/30 mt-2 uppercase tracking-wider">Version B</p>
                    </div>
                    {splashStyle === "lowercase" && (
                      <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                  </button>
                </div>

                <p className="text-[10px] text-white/20 text-center mt-4">
                  Refresh the app to see your new splash screen
                </p>
              </div>

              {/* About Section */}
              <div className="p-4 rounded-2xl bg-black/40">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-white/40" />
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">About</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-white/50">Version</span>
                    <span className="text-xs text-white">2.0.0</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-white/5">
                    <span className="text-xs text-white/50">Data Provider</span>
                    <span className="text-xs text-white">Tradier API</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-white/5">
                    <span className="text-xs text-white/50">Theme</span>
                    <span className="text-xs text-white">Dark</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <TradeArchivePanel />
          )}
        </div>
      </div>

      {/* Hidden canvas for image compression */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Crop Modal */}
      {showCropModal && tempImage && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0a0a0a] rounded-2xl overflow-hidden border border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="text-sm font-medium text-white">Crop Photo</h3>
              <button
                onClick={() => {
                  setShowCropModal(false)
                  setTempImage(null)
                }}
                className="p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white/50" />
              </button>
            </div>

            {/* Crop Area */}
            <div className="relative aspect-square bg-black overflow-hidden">
              {/* Draggable image - rendered first so it's behind the overlay */}
              <div
                className="absolute inset-0 cursor-move flex items-center justify-center overflow-visible"
                onMouseDown={handleCropDragStart}
                onMouseMove={handleCropDragMove}
                onMouseUp={handleCropDragEnd}
                onMouseLeave={handleCropDragEnd}
                onTouchStart={handleCropDragStart}
                onTouchMove={handleCropDragMove}
                onTouchEnd={handleCropDragEnd}
              >
                {tempImage && (
                  <img
                    src={tempImage || "/placeholder.svg"}
                    alt="Crop preview"
                    className="select-none pointer-events-none"
                    style={{
                      maxWidth: "none",
                      maxHeight: "none",
                      minWidth: "100%",
                      minHeight: "100%",
                      objectFit: "contain",
                      transform: `translate(${cropPosition.x}px, ${cropPosition.y}px) scale(${cropScale})`,
                    }}
                    draggable={false}
                  />
                )}
              </div>

              {/* Circular crop overlay - rendered on top */}
              <div className="absolute inset-0 pointer-events-none z-10">
                <svg className="w-full h-full">
                  <defs>
                    <mask id="circleMask">
                      <rect width="100%" height="100%" fill="white" />
                      <circle cx="50%" cy="50%" r="40%" fill="black" />
                    </mask>
                  </defs>
                  <rect width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#circleMask)" />
                  <circle cx="50%" cy="50%" r="40%" fill="none" stroke="white" strokeWidth="2" opacity="0.6" />
                </svg>
              </div>
            </div>

            {/* Zoom Controls */}
            <div className="px-4 py-3 border-t border-white/10">
              <div className="flex items-center gap-3">
                <ZoomOut className="w-4 h-4 text-white/40" />
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={cropScale}
                  onChange={(e) => setCropScale(parseFloat(e.target.value))}
                  className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />
                <ZoomIn className="w-4 h-4 text-white/40" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-4 py-4 border-t border-white/10">
              <button
                onClick={() => {
                  setShowCropModal(false)
                  setTempImage(null)
                }}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-sm text-white/70 hover:bg-white/15 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCrop}
                className="flex-1 py-2.5 rounded-xl bg-[#ec3b70] text-sm text-white font-medium hover:bg-[#d6336a] transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
