interface DateUtils {
  getDayName: (dayNumber: number) => string;
  getDateForDay: (weekStartDate: string | null, dayNumber: number) => string;
  isDayInPast: (weekStartDate: string | null, dayNumber: number) => boolean;
}

export const useDateUtils = (): DateUtils => {
  /**
   * Converts a day number (1-7) to its corresponding day name
   * @param {number} dayNumber - The day number (1 = Monday, 7 = Sunday)
   * @returns {string} The name of the day
   * @throws Will throw an error if dayNumber is outside the range 1-7
   */
  const getDayName = (dayNumber: number): string => {
    const days: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[dayNumber - 1];
  };

  /**
   * Calculates and formats the date for a specific day of the week based on a week start date
   * @param {string | null} weekStartDate - The start date of the week in ISO format
   * @param {number} dayNumber - The day number (1 = Monday, 7 = Sunday)
   * @returns {string} Formatted date string (e.g., "15 Mar") or empty string if invalid input
   */
  const getDateForDay = (weekStartDate: string | null, dayNumber: number): string => {
    if (!weekStartDate) return '';
    
    try {
      const startDate: Date = new Date(weekStartDate);
      if (isNaN(startDate.getTime())) return '';
      
      const dayOffset: number = dayNumber - 1; // Subtract 1 because Monday is 1 in our system
      const date: Date = new Date(startDate);
      date.setDate(startDate.getDate() + dayOffset);
      
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch (error) {
      console.error('Error calculating date:', error);
      return '';
    }
  };

  /**
   * Determines if a given day is in the past relative to the current date.
   * Only returns true for past days in the current week.
   * @param {string | null} weekStartDate - The start date of the week in ISO format
   * @param {number} dayNumber - The day number (1 = Monday, 7 = Sunday)
   * @returns {boolean} True if the day is in the past and in the current week, false otherwise
   */
  const isDayInPast = (weekStartDate: string | null, dayNumber: number): boolean => {
    if (!weekStartDate) return false;
    
    try {
      const startDate: Date = new Date(weekStartDate);
      if (isNaN(startDate.getTime())) return false;
      
      const today: Date = new Date();
      today.setHours(0, 0, 0, 0);

      // Get the start of the current week (Monday)
      const currentWeekStart: Date = new Date(today);
      const currentDayOfWeek: number = today.getDay() || 7; // Convert Sunday (0) to 7
      currentWeekStart.setDate(today.getDate() - (currentDayOfWeek - 1));
      currentWeekStart.setHours(0, 0, 0, 0);

      // If the week start date is not the current week, return false
      if (startDate.getTime() !== currentWeekStart.getTime()) {
        return false;
      }
      
      const dayOffset: number = dayNumber - 1;
      const date: Date = new Date(startDate);
      date.setDate(startDate.getDate() + dayOffset);
      date.setHours(0, 0, 0, 0);
      
      return date < today;
    } catch (error) {
      console.error('Error checking if day is in past:', error);
      return false;
    }
  };

  return {
    getDayName,
    getDateForDay,
    isDayInPast
  };
};
