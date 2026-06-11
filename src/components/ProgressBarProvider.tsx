'use client';

import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';
import React, { Suspense } from 'react';

const ProgressBarProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <ProgressBar
          height="4px"
          color="#e11d48"
          options={{ showSpinner: true }}
          shallowRouting
        />
      </Suspense>
    </>
  );
};

export default ProgressBarProvider;
