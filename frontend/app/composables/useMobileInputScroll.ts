import { Capacitor } from '@capacitor/core';

export const useMobileInputScroll = () => {
  const scrollToInput = (element: HTMLElement | null) => {
    if (!element) return;
    
    // Use a longer delay for Android to ensure keyboard is fully opened
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isCapacitor = Capacitor.isNativePlatform();
    const delay = (isAndroid && isCapacitor) ? 500 : isAndroid ? 300 : 100;
    
    setTimeout(() => {
      nextTick(() => {
        // Get the element's position relative to the viewport
        const rect = element.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        // More accurate keyboard height detection for different platforms
        let keyboardHeight = 0;
        
        if (isAndroid && isCapacitor) {
          // Capacitor Android keyboard typically takes 50-70% of screen height
          // Use a more aggressive estimate for better compatibility
          keyboardHeight = viewportHeight * 0.6;
        } else if (isAndroid) {
          // Regular Android keyboard typically takes 40-60% of screen height
          keyboardHeight = viewportHeight * 0.5;
        } else if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
          // iOS keyboard is more predictable
          keyboardHeight = viewportHeight * 0.4;
        } else {
          // Desktop fallback
          keyboardHeight = viewportHeight * 0.3;
        }
        
        const visibleArea = viewportHeight - keyboardHeight;
        
        // Check if the input is hidden by the keyboard
        if (rect.bottom > visibleArea) {
          const scrollAmount = rect.bottom - visibleArea + 80; // Add more padding for better visibility
          
          // For Capacitor Android, always use instant scroll and be more aggressive
          const scrollBehavior = (isAndroid && isCapacitor) ? 'auto' : isAndroid ? 'auto' : 'smooth';
          
          // For Capacitor Android, try multiple scroll strategies
          if (isAndroid && isCapacitor) {
            // First try scrolling the parent container
            const scrollableParent = findScrollableParent(element);
            if (scrollableParent) {
              scrollableParent.scrollTop += scrollAmount;
            } else {
              // Fallback to window scroll
              window.scrollBy({
                top: scrollAmount,
                behavior: scrollBehavior
              });
            }
            
            // Also try scrolling the element into view as a backup
            setTimeout(() => {
              element.scrollIntoView({ 
                behavior: 'auto', 
                block: 'center',
                inline: 'nearest'
              });
            }, 100);
          } else {
            // For other platforms, use the standard approach
            const scrollableParent = findScrollableParent(element);
            if (scrollableParent && isAndroid) {
              scrollableParent.scrollTop += scrollAmount;
            } else {
              window.scrollBy({
                top: scrollAmount,
                behavior: scrollBehavior
              });
            }
          }
        }
      });
    }, delay);
  };

  // Helper function to find the nearest scrollable parent
  const findScrollableParent = (element: HTMLElement): HTMLElement | null => {
    let parent = element.parentElement;
    
    while (parent) {
      const style = window.getComputedStyle(parent);
      const overflow = style.overflow + style.overflowY + style.overflowX;
      
      if (overflow.includes('scroll') || overflow.includes('auto')) {
        return parent;
      }
      
      parent = parent.parentElement;
    }
    
    return null;
  };

  const handleInputFocus = (event: Event) => {
    const target = event.target as HTMLElement;
    scrollToInput(target);
    
    // For Capacitor Android, also listen for keyboard resize events
    if (Capacitor.isNativePlatform() && /Android/i.test(navigator.userAgent)) {
      // Add a resize listener to handle keyboard opening
      const handleResize = () => {
        setTimeout(() => {
          scrollToInput(target);
        }, 100);
      };
      
      window.addEventListener('resize', handleResize, { once: true });
      
      // Also try scrolling again after a longer delay
      setTimeout(() => {
        scrollToInput(target);
      }, 800);
    }
  };

  return {
    scrollToInput,
    handleInputFocus
  };
};
