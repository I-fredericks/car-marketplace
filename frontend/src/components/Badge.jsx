import React from 'react';

const Badge = ({ type = 'neutral', children }) => {
  const baseClasses = "px-2 py-1 text-xs font-semibold rounded-md flex items-center gap-1";
  
  const typeClasses = {
    success: "bg-[#2F9E62]/10 text-success", // success color with opacity
    accent: "bg-[#E8A33D]/10 text-accentdark",
    warn: "bg-[#D97706]/10 text-warn",
    err: "bg-[#DC4C3F]/10 text-err",
    neutral: "bg-bordercol text-textsecondary",
  };

  return (
    <span className={`${baseClasses} ${typeClasses[type] || typeClasses.neutral}`}>
      {children}
    </span>
  );
};

export default Badge;
