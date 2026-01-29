// Hidden element for iOS text selection haptic trick
let hiddenSelectableElement: HTMLSpanElement | null = null

function getHiddenSelectable(): HTMLSpanElement | null {
  if (typeof document === "undefined") return null

  if (!hiddenSelectableElement) {
    hiddenSelectableElement = document.createElement("span")
    hiddenSelectableElement.textContent = "\u200B" // Zero-width space
    hiddenSelectableElement.style.cssText = `
      position: fixed;
      top: -9999px;
      left: -9999px;
      opacity: 0;
      pointer-events: none;
      user-select: text;
      -webkit-user-select: text;
      font-size: 1px;
    `
    document.body.appendChild(hiddenSelectableElement)
  }
  return hiddenSelectableElement
}

// iOS haptic via text selection trick
function triggerIOSHaptic() {
  if (typeof window === "undefined" || typeof document === "undefined") return

  const el = getHiddenSelectable()
  if (!el) return

  try {
    // Create a range and select the hidden text
    const range = document.createRange()
    range.selectNodeContents(el)

    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)

      // Immediately clear selection to prevent any visible effect
      setTimeout(() => {
        selection.removeAllRanges()
      }, 1)
    }
  } catch (e) {
    // Selection not supported, fail silently
  }
}

// Trigger haptic/feedback
export function triggerHaptic(style: "light" | "medium" | "heavy" = "light") {
  // Try native vibration first (Android)
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    const duration = style === "light" ? 10 : style === "medium" ? 25 : 50
    navigator.vibrate(duration)
  }

  // iOS haptic via text selection trick
  triggerIOSHaptic()
}

// Visual pulse feedback - call this to add a pulse animation to an element
export function triggerVisualPulse(element: HTMLElement | null) {
  if (!element) return

  element.classList.add("feedback-pulse")
  setTimeout(() => {
    element.classList.remove("feedback-pulse")
  }, 150)
}
