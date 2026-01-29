"use client"

import { Activity, BarChart3, LineChart, User } from "lucide-react"
import { triggerHaptic } from "@/lib/haptics"

interface BottomNavProps {
  activeTab: string
  onTabChange: (tab: string) => void
  onCloseSettings?: () => void
}

export function BottomNav({ activeTab, onTabChange, onCloseSettings }: BottomNavProps) {
  const tabs = [
    { id: "market", icon: Activity, label: "Market", anchor: "#market" },
    { id: "analysis", icon: BarChart3, label: "Analysis", anchor: "#analysis" },
    { id: "simulate", icon: LineChart, label: "Simulate", anchor: "#options-simulation" },
    { id: "profile", icon: User, label: "Profile", anchor: "#settings" },
  ]

  const handleTabClick = (tab: (typeof tabs)[0]) => {
    triggerHaptic("light")

    if (tab.id !== "profile" && onCloseSettings) {
      onCloseSettings()
    }

    onTabChange(tab.id)

    if (tab.id !== "profile") {
      const element = document.querySelector(tab.anchor)
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }
  }

  return (
    <div className="fixed left-0 right-0 bottom-0 z-[9999] pb-safe">
      <nav className="mx-auto w-fit px-4 pb-6">
        {/* Floating pill container with glass effect */}
        <div className="flex items-center gap-1 px-2 py-2 rounded-full bg-black/60 backdrop-blur-2xl shadow-2xl shadow-black/50 border border-white/5">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-200 min-h-[44px] ${
                  isActive ? "bg-white/15 text-white" : "text-white/50 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                <Icon className="h-5 w-5" />
                {isActive && <span className="text-xs font-medium">{tab.label}</span>}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
