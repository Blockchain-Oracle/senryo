'use client';

import { useState } from 'react';
import NumberFlow, { type Value } from "@number-flow/react";

const values: Value[] = [398.43, -3243.5, 1435237];

function NumberFlowDemo() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleClick = () => {
    setCurrentIndex((prev) => (prev + 1) % values.length);
  };

  return (
    <div 
      onClick={handleClick}
      className="min-h-screen w-full min-w-[100vw]  flex flex-col items-center justify-center cursor-pointer text-[40px]"
    >
      <div className="pointer-events-none">
        <NumberFlow value={values[currentIndex]} trend={false} />
      </div>
      <p className="absolute bottom-6 text-sm text-gray-500 pointer-events-none">
        Click anywhere to change values
      </p>
    </div>
  );
}


export default function __All(){return <div className="flex w-full flex-col items-center gap-6"><NumberFlowDemo /></div>}
