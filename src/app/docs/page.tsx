'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Compass, ExternalLink } from 'lucide-react';

export default function SwaggerDocsPage() {
  useEffect(() => {
    // Dynamically load Swagger UI CSS and JavaScript
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js';
    script.async = true;
    script.onload = () => {
      // @ts-expect-error - SwaggerUIBundle is loaded via external script
      if (window.SwaggerUIBundle) {
        // @ts-expect-error - SwaggerUIBundle
        window.SwaggerUIBundle({
          url: '/api/openapi.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [
            // @ts-expect-error - SwaggerUIBundle
            window.SwaggerUIBundle.presets.apis,
            // @ts-expect-error - SwaggerUIStandalonePreset
            window.SwaggerUIStandalonePreset,
          ],
          layout: 'BaseLayout',
          defaultModelsExpandDepth: 2,
          defaultModelExpandDepth: 2,
          docExpansion: 'list',
          persistAuthorization: true,
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      if (link.parentNode) link.parentNode.removeChild(link);
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-xs sm:text-sm font-bold text-gray-700 hover:text-blue-600 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to LostFound App</span>
            </Link>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                LF
              </div>
              <span className="font-bold text-gray-900 text-sm">Interactive Swagger UI</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <a
              href="/api/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:underline font-semibold"
            >
              <span>Raw OpenAPI JSON</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Swagger UI Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-8">
          <div id="swagger-ui" />
        </div>
      </main>
    </div>
  );
}

