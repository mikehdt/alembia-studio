import './globals.css';

import type { Metadata } from 'next';
import { Geist } from 'next/font/google';

import { AppProvider } from './providers/AppProvider';
import { StoreProvider } from './providers/StoreProvider';
import { ActivityPanel } from './shared/activity-panel/activity-panel';
import { ModalProvider } from './shared/modal';
import { ModelManagerModal } from './shared/model-manager-modal/model-manager-modal';
import { PopupProvider } from './shared/popup';
import { StableLayout } from './shared/stable-layout';
import { ToastContainer } from './shared/toast';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  fallback: ['system-ui', 'arial'],
});

export const metadata: Metadata = {
  title: 'Image Tagger',
  description: 'Tag images with text to identify things',
  icons: {
    icon: [
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon-96.png', sizes: '96x96', type: 'image/png' },
      {
        url: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
    apple: [
      { url: '/favicon-128.png', sizes: '128x128', type: 'image/png' },
      { url: '/favicon-196.png', sizes: '196x196', type: 'image/png' },
    ],
    other: [
      {
        rel: 'apple-touch-icon',
        url: '/favicon-196.png',
      },
    ],
  },
};

export default function Root({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={geistSans.className}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=localStorage.getItem('preferences');var t='auto';if(p){var o=JSON.parse(p);if(o&&(o.theme==='light'||o.theme==='dark'||o.theme==='auto'))t=o.theme;}var d=t==='dark'||(t==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.add(d?'dark':'light');}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <StoreProvider>
          <AppProvider>
            <ModalProvider>
              <PopupProvider>
                <StableLayout>{children}</StableLayout>
                <ModelManagerModal />
              </PopupProvider>
              <ToastContainer />
              <ActivityPanel />
            </ModalProvider>
          </AppProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
