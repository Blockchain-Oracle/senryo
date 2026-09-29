import { useState, useEffect } from "react";

export function CopyCode({ code = "21DEV-LEO", display, className = "" }: { code?: string; display?: string; className?: string } = {}) {
  const [copied, setCopied] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [progress, setProgress] = useState(0);
  const duration = 4000;

  useEffect(() => {
    if (copied) {
      // Delay showing confirmation to allow blur-out animation
      const showTimer = setTimeout(() => {
        setShowConfirmation(true);
      }, 400);

      setProgress(0);
      const startTime = Date.now();
      
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const newProgress = Math.min((elapsed / duration) * 100, 100);
        setProgress(newProgress);
        
        if (elapsed >= duration) {
          clearInterval(interval);
          setShowConfirmation(false);
          setTimeout(() => {
            setCopied(false);
            setProgress(0);
          }, 400);
        }
      }, 16);

      return () => {
        clearInterval(interval);
        clearTimeout(showTimer);
      };
    }
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch (err) {
      // Fallback for when Clipboard API is blocked
      const textArea = document.createElement('textarea');
      textArea.value = code;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setCopied(true);
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="relative overflow-hidden flex items-center justify-center bg-muted rounded-[calc(var(--radius)*2)] px-6 py-3 w-full h-14">
        {/* Progress background */}
        <div 
          className="absolute left-0 top-0 bottom-0 bg-foreground/10"
          style={{ 
            width: `${progress}%`,
            opacity: copied ? 1 : 0,
            transition: 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
        
        {/* Original content - code and button */}
        <div 
          className="absolute inset-0 flex items-center justify-between pl-6 pr-2"
          style={{
            opacity: copied ? 0 : 1,
            filter: copied ? 'blur(12px)' : 'blur(0px)',
            transform: copied ? 'scale(0.92)' : 'scale(1)',
            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: copied ? 'none' : 'auto',
            zIndex: copied ? 0 : 20,
          }}
        >
          <span className="text-base font-medium font-mono tracking-wide text-muted-foreground select-all truncate max-w-56">
            {display ?? code}
          </span>
          <button
            onClick={handleCopy}
            className="bg-card text-foreground font-medium text-base px-5 py-2.5 rounded-[var(--radius)] border border-border shadow-sm dark:shadow-black/30 transition-all duration-300 hover:shadow-md dark:hover:shadow-black/50 active:scale-95 cursor-pointer select-none"
          >
            Copy
          </button>
        </div>

        {/* Confirmation content - Address copied */}
        <div 
          className="relative flex items-center gap-3"
          style={{
            opacity: showConfirmation ? 1 : 0,
            filter: showConfirmation ? 'blur(0px)' : 'blur(12px)',
            transform: showConfirmation ? 'scale(1)' : 'scale(1.08)',
            transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <div className="w-7 h-7 bg-foreground rounded-full flex items-center justify-center">
            <svg 
              className="w-4 h-4 text-background" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={3} 
                d="M5 13l4 4L19 7"
                style={{
                  strokeDasharray: 24,
                  strokeDashoffset: showConfirmation ? 0 : 24,
                  transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.3s',
                }}
              />
            </svg>
          </div>
          <span className="text-base font-semibold text-foreground">
            Address copied
          </span>
        </div>
      </div>
    </div>
  );
}