import React from 'react';

const SpecGrid = ({ specs }) => {
  if (!specs || specs.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 border-t border-l border-bordercol bg-surface rounded-md overflow-hidden">
      {specs.map((spec, index) => (
        <div key={index} className="p-3 border-r border-b border-bordercol flex flex-col justify-center">
          <span className="text-xs text-textmuted uppercase tracking-wider font-semibold">{spec.label}</span>
          <span className="text-sm text-textprimary font-medium mt-1">{spec.value}</span>
        </div>
      ))}
    </div>
  );
};

export default SpecGrid;
