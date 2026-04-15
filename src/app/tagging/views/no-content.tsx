'use client';

import { BoxSelectIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { SyntheticEvent } from 'react';

import { Button } from '@/app/shared/button';
import { useAppSelector } from '@/app/store/hooks';
import { selectProjectName } from '@/app/store/project';

type NoContentProps = { onReload: () => void };

export const NoContent = ({ onReload }: NoContentProps) => {
  const router = useRouter();
  const projectName = useAppSelector(selectProjectName);

  const doReload = (e: SyntheticEvent) => {
    e.preventDefault();
    onReload();
  };

  const handleBackToProjects = () => {
    router.push('/');
  };

  return (
    <div className="mx-auto flex w-full max-w-120 min-w-80 flex-wrap justify-center px-4 py-20 text-center">
      <BoxSelectIcon className="h-full w-full max-w-80 text-slate-500" />

      <h1 className="mt-4 mb-4 w-full text-xl text-slate-500">
        No assets found
        {projectName ? ` in ${projectName}` : ''}
      </h1>

      <div className="mt-4 flex w-full justify-center gap-3">
        <Button onClick={doReload} size="md" width="xl">
          Refresh
        </Button>

        <Button onClick={handleBackToProjects} size="md" width="xl">
          Back to Project List
        </Button>
      </div>
    </div>
  );
};
