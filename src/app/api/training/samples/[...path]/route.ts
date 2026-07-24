import fs from 'node:fs';
import path from 'node:path';

import { NextRequest, NextResponse } from 'next/server';

import { getImageMimeType, isSupportedImageExtension } from '@/app/constants';
import { getProjectsFolder } from '@/app/services/config/server-config';
import { resolveLoraOutputDir } from '@/app/services/training/output-path';

/** True if `target` resolves to a path at or below `root`. */
const isWithin = (root: string, target: string): boolean => {
  const rel = path.relative(root, target);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: pathSegments } = await params;

    // Confine everything to the loras output root — the same resolver the
    // training request builder uses, so this always matches where samples
    // actually land (falls back to .training/outputs when unconfigured).
    const samplesRoot = path.resolve(
      resolveLoraOutputDir(getProjectsFolder()) ??
        path.join(process.cwd(), '.training', 'outputs'),
    );
    const resolvedPath = path.resolve(samplesRoot, ...pathSegments);

    if (!isWithin(samplesRoot, resolvedPath)) {
      return new NextResponse('Access denied', { status: 403 });
    }

    // This route only ever serves sample images — reject anything else
    // before touching disk.
    const ext = path.extname(resolvedPath).toLowerCase();
    if (!isSupportedImageExtension(ext)) {
      return new NextResponse('Not found', { status: 404 });
    }

    if (!fs.existsSync(resolvedPath)) {
      return new NextResponse('Sample not found', { status: 404 });
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      return new NextResponse('Not found', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(resolvedPath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': getImageMimeType(ext),
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable', // Filenames are timestamped/immutable
      },
    });
  } catch (error) {
    console.error('Error serving training sample:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
