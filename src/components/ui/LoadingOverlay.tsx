import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingOverlayProps {
  show: boolean;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  show, 
  onClose, 
  showCloseButton = false 
}) => {
  const [isX, setIsX] = React.useState(true);

  React.useEffect(() => {
    if (!show) return;
    const interval = setInterval(() => {
      setIsX((prev) => !prev);
    }, 1200); // Slightly slower for more dramatic effect
    return () => clearInterval(interval);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white bg-opacity-95 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Close button in top-right corner */}
          {showCloseButton && onClose && (
            <button
              onClick={onClose}
              className="absolute top-6 right-6 text-black hover:text-gray-600 transition-colors p-2"
              aria-label="Close overlay"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}

          <div className="relative w-24 h-24 mb-8">
            {/* X Shape - Geometric, segmented style */}
            <motion.svg
              width={96}
              height={96}
              viewBox="0 0 96 96"
              fill="none"
              className="absolute inset-0"
              animate={{
                opacity: isX ? 1 : 0,
                rotate: isX ? 0 : -15,
                scale: isX ? 1 : 0.85,
              }}
              transition={{
                duration: 0.6,
                ease: "easeInOut",
              }}
            >
              {/* Top-left to bottom-right diagonal */}
              <rect x="8" y="8" width="20" height="8" fill="black" />
              <rect x="28" y="16" width="8" height="20" fill="black" />
              <rect x="36" y="36" width="20" height="8" fill="black" />
              <rect x="56" y="44" width="8" height="20" fill="black" />
              <rect x="64" y="64" width="20" height="8" fill="black" />
              
              {/* Top-right to bottom-left diagonal */}
              <rect x="68" y="8" width="20" height="8" fill="black" />
              <rect x="60" y="16" width="8" height="20" fill="black" />
              <rect x="40" y="36" width="20" height="8" fill="black" />
              <rect x="32" y="44" width="8" height="20" fill="black" />
              <rect x="12" y="64" width="20" height="8" fill="black" />
            </motion.svg>

            {/* O Shape - Geometric, segmented style with negative space */}
            <motion.svg
              width={96}
              height={96}
              viewBox="0 0 96 96"
              fill="none"
              className="absolute inset-0"
              animate={{
                opacity: isX ? 0 : 1,
                rotate: isX ? 15 : 0,
                scale: isX ? 0.85 : 1,
              }}
              transition={{
                duration: 0.6,
                ease: "easeInOut",
              }}
            >
              {/* Top segment */}
              <rect x="20" y="12" width="56" height="12" fill="black" />
              
              {/* Right segment */}
              <rect x="72" y="24" width="12" height="48" fill="black" />
              
              {/* Bottom segment */}
              <rect x="20" y="72" width="56" height="12" fill="black" />
              
              {/* Left segment */}
              <rect x="12" y="24" width="12" height="48" fill="black" />
              
              {/* Inner negative space - white diamond */}
              <rect x="36" y="36" width="24" height="24" fill="white" />
              <polygon points="36,36 48,24 60,36 48,48" fill="white" />
              <polygon points="60,36 72,48 60,60 48,48" fill="white" />
              <polygon points="60,60 48,72 36,60 48,48" fill="white" />
              <polygon points="36,60 24,48 36,36 48,48" fill="white" />
            </motion.svg>
          </div>

          <div className="text-3xl font-bold text-black tracking-wider">
            GAME STARTING SOON
          </div>
          
          <div className="mt-4 text-sm text-gray-600 tracking-wide">
            Preparing your match...
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingOverlay; 