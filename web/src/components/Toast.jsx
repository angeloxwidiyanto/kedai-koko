import { motion } from 'framer-motion'

export default function Toast({ message, onDone }) {
  return (
    <motion.div
      className="toast"
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onAnimationComplete={() => {
        setTimeout(onDone, 1200)
      }}
    >
      <span className="material-symbols-outlined">check_circle</span>
      <span>{message}</span>
    </motion.div>
  )
}
