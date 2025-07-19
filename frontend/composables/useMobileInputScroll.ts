export const useMobileInputScroll = () => {
  const scrollToInput = (element: HTMLElement | null) => {
    if (!element) return;
    
    // Use a longer delay for Android to ensure keyboard is fully opened
    const isAndroid = /Android/i.test(navigator.userAgent);
    const delay = isAndroid ? 300 : 100;
    
    setTimeout(() => {
      nextTick(() => {
        // Get the element's position relative to the viewport
        const rect = element.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        // More accurate keyboard height detection for different platforms
        let keyboardHeight = 0;
        
        if (isAndroid) {
          // Android keyboard typically takes 40-60% of screen height
          // Use a more conservative estimate for better compatibility
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
          const scrollAmount = rect.bottom - visibleArea + 50; // Add more padding for better visibility
          
          // Use instant scroll on mobile for better performance and reliability
          const scrollBehavior = isAndroid ? 'auto' : 'smooth';
          
          // For Android, we might need to scroll the parent container
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
  };

  return {
    scrollToInput,
    handleInputFocus
  };
};
