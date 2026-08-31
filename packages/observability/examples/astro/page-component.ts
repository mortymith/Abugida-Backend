/**
 * @example astro/page-component
 * @description Instrumenting an Astro page component with spans and metrics.
 *
 * File: src/pages/index.astro
 * ---
 * import { withPageSpan, recordAstroError } from "../src/integrations/astro.ts";
 * import { createCounter, createHistogram } from "../src/index.ts";
 *
 * const pageViewCounter = createCounter("marketing_page_views_total", {
 *   description: "Total number of marketing page views",
 * });
 *
 * const renderDuration = createHistogram("marketing_render_duration_ms", {
 *   description: "Marketing page render duration in milliseconds",
 *   unit: "ms",
 * });
 *
 * const data = await withPageSpan("page.home", async (span) => {
 *   span.setAttribute("astro.page", "/");
 *   pageViewCounter.add(1, { page: "home" });
 *
 *   const start = performance.now();
 *   try {
 *     const result = await fetchHomeContent();
 *     return result;
 *   } finally {
 *     renderDuration.record(performance.now() - start, { page: "home" });
 *   }
 * });
 * ---
 *
 * <html>
 *   <head>
 *     <title>{data.title}</title>
 *   </head>
 *   <body>
 *     <h1>{data.headline}</h1>
 *     <p>{data.description}</p>
 *   </body>
 * </html>
 */

interface HomeContent {
  title: string
  headline: string
  description: string
}

async function fetchHomeContent(): Promise<HomeContent> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  return {
    title: 'Welcome to Abugida',
    headline: 'Learn Ethiopian languages',
    description: "Master Ge'ez, Amharic, and Tigrinya online.",
  }
}

export { fetchHomeContent }
