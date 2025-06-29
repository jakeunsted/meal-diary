export const useMobileInputScroll = () => {
  const scrollToInput = (element: HTMLElement | null) => {
    if (!element) return;
    
    nextTick(() => {
      // Get the element's position relative to the viewport
      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // More accurate keyboard height detection for mobile
      // On mobile, keyboard typically takes 40-50% of screen height
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const keyboardHeight = isMobile ? viewportHeight * 0.45 : viewportHeight * 0.3;
      const visibleArea = viewportHeight - keyboardHeight;
      
      if (rect.bottom > visibleArea) {
        const scrollAmount = rect.bottom - visibleArea + 30; // Add 30px padding for better visibility
        
        // Use smooth scroll on desktop, instant scroll on mobile for better performance
        const scrollBehavior = isMobile ? 'auto' : 'smooth';
        
        window.scrollBy({
          top: scrollAmount,
          behavior: scrollBehavior
        });
      }
    });
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
