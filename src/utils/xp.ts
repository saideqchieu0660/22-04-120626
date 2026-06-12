export const getLevelInfo = (xp: number) => {
  const currentLevel = Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1);
  const currentLevelXp = Math.pow(currentLevel - 1, 2) * 50;
  const nextLevelXp = Math.pow(currentLevel, 2) * 50;
  
  const xpIntoCurrentLevel = xp - currentLevelXp;
  const xpNeededForNextLevel = nextLevelXp - currentLevelXp;
  const progressPercentage = Math.min(100, Math.max(0, (xpIntoCurrentLevel / xpNeededForNextLevel) * 100));

  let title = "Tập sự";
  if (currentLevel >= 3) title = "Học giả";
  if (currentLevel >= 6) title = "Tinh anh";
  if (currentLevel >= 10) title = "Đại sư";
  if (currentLevel >= 15) title = "Quang vinh";
  if (currentLevel >= 20) title = "Thần thoại";
  if (currentLevel >= 30) title = "Chân lý";

  let titleColor = "text-stone-500 font-medium";
  let badgeColors = "from-stone-400 to-stone-500 text-stone-900";
  
  if (currentLevel >= 3) {
    titleColor = "text-blue-500 font-semibold";
    badgeColors = "from-blue-400 to-blue-500 text-white shadow-blue-500/20";
  }
  if (currentLevel >= 6) {
    titleColor = "text-purple-500 font-semibold";
    badgeColors = "from-purple-400 to-purple-600 text-white shadow-purple-500/30";
  }
  if (currentLevel >= 10) {
    titleColor = "text-amber-500 font-bold";
    badgeColors = "from-amber-400 to-orange-500 text-white shadow-amber-500/40";
  }
  if (currentLevel >= 15) {
    titleColor = "text-red-500 font-bold";
    badgeColors = "from-rose-500 to-red-600 text-white shadow-red-500/50";
  }
  if (currentLevel >= 20) {
    titleColor = "text-yellow-600 font-black animate-pulse";
    badgeColors = "from-yellow-300 via-amber-500 to-yellow-600 text-white shadow-yellow-500/60 ring-2 ring-yellow-400/50";
  }
  if (currentLevel >= 30) {
    titleColor = "text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-fuchsia-500 to-amber-400 font-black";
    badgeColors = "from-blue-500 via-purple-500 to-amber-500 text-white shadow-fuchsia-500/60 ring-2 ring-purple-400/50";
  }

  return {
    currentLevel,
    currentLevelXp,
    nextLevelXp,
    xpIntoCurrentLevel,
    xpNeededForNextLevel,
    progressPercentage,
    title,
    titleColor,
    badgeColors
  };
};
