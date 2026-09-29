"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

const PERSPECTIVE = 400
const CARD_ANIMATION_DURATION = 0.5
const INITIAL_DELAY = 0.2

const springTransition = {
  type: "spring",
  stiffness: 100,
  damping: 30,
}

const fadeInVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

interface CreditCardProps extends React.HTMLAttributes<HTMLDivElement> {
  cardNumber: string
  cardHolder: string
  expiryDate: string
  variant?: "default" | "dark"
}

const CreditCard = React.forwardRef<HTMLDivElement, CreditCardProps>(
  ({ className, cardNumber, cardHolder, expiryDate, variant = "default", ...props }, ref) => {
    const [isVisible, setIsVisible] = React.useState(false)

    const getMaskedNumber = (number: string) => {
      const lastFour = number.slice(-4)
      return `**** **** **** ${lastFour}`
    }

    const variants = {
      default: "bg-secondary text-secondary-foreground border-2 border-foreground shadow-[6px_6px_0_0_var(--foreground)]",
      dark: "bg-slate-800 text-white",
    }

    return (
      <motion.div
        ref={ref}
        initial="hidden"
        animate="visible"
        variants={fadeInVariants}
        transition={{ duration: CARD_ANIMATION_DURATION }}
        style={{ perspective: PERSPECTIVE }}
        className={cn("relative touch-none", className)}
        {...props}
      >
        <motion.div
          className={cn(
            "relative h-52 w-[340px] overflow-hidden rounded-[var(--radius)] p-6",
            variants[variant]
          )}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: CARD_ANIMATION_DURATION }}
        >
          <div className="flex items-center justify-between">
            <motion.div
              className="text-2xl font-bold"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: INITIAL_DELAY, duration: CARD_ANIMATION_DURATION }}
            >
              VISA
            </motion.div>

            <motion.button
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                variant === "default" ? "bg-background border-2 border-foreground" : "bg-slate-700"
              )}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, ...springTransition }}
              onClick={() => setIsVisible(!isVisible)}
              aria-label={isVisible ? "Hide card details" : "Show card details"}
            >
              {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </motion.button>
          </div>

          <motion.div
            className="mt-2 text-xl font-medium tracking-wider"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            {isVisible ? cardNumber : getMaskedNumber(cardNumber)}
          </motion.div>

          <div className="mt-6 flex justify-between">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: CARD_ANIMATION_DURATION }}
            >
              <div className="text-xs opacity-80">Card Holder</div>
              <div className="font-semibold">{cardHolder}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: CARD_ANIMATION_DURATION }}
            >
              <div className="text-xs opacity-80">Expires</div>
              <div className="font-semibold">{isVisible ? expiryDate : "**/**"}</div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    )
  }
)
CreditCard.displayName = "CreditCard"

export { CreditCard }