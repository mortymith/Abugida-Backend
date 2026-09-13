<!-- intent-skills:start -->

# TanStack Intent - before editing files, run the matching guidance command.

# Course Builder Architecture Instructions

You are working on a **TanStack Start course builder web application**.

Follow these architectural and naming conventions whenever creating, modifying, or moving files.

## 1. Architecture Principles

- Use **TanStack Start** as the application framework.
- Use **TanStack Router file-based routing**.
- Keep route files focused on routing, route configuration, data loading, and page composition.
- Keep course-builder business logic inside `features/`.
- Keep globally reusable UI components inside `components/`.
- Keep generic application utilities and infrastructure inside `lib/`.
- Keep server-only application code inside `server/`.
- Keep external integrations inside `integrations/`.
- Avoid placing substantial business logic directly inside route files.

The architecture should prioritize:

- Clear feature ownership
- Small and focused modules
- Predictable file locations
- Strong separation between routing and business logic
- Reusability without unnecessary abstraction

---

# 2. Directory Structure

Use the following structure as the default:

```text
src/
├── routes/
│   ├── __root.tsx
│   ├── index.tsx
│   │
│   ├── _auth/
│   │   ├── route.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   │
│   └── _app/
│       ├── route.tsx
│       ├── index.tsx
│       │
│       ├── courses/
│       │   ├── index.tsx
│       │   ├── new.tsx
│       │   └── $courseId/
│       │       ├── index.tsx
│       │       ├── edit.tsx
│       │       ├── settings.tsx
│       │       └── preview.tsx
│       │
│       └── ...
│
├── features/
│   ├── courses/
│   ├── lessons/
│   ├── sections/
│   ├── assessments/
│   ├── media/
│   ├── publishing/
│   └── ...
│
├── components/
│   ├── ui/
│   ├── layout/
│   └── common/
│
├── lib/
│   ├── auth.ts
│   ├── env.ts
│   ├── http.ts
│   └── utils.ts
│
├── server/
│   ├── functions/
│   ├── middleware/
│   └── utils/
│
├── integrations/
│   └── ...
│
├── styles/
│   └── globals.css
│
└── router.tsx
```

Only create directories that are actually required. Do not create empty folders merely to match this template.

---

# 3. Route Organization

All application routes must live under:

```text
src/routes/
```

Use TanStack Router's file-based routing conventions.

Route files should contain:

- Route definitions
- Route parameters
- Search parameters
- Loaders
- Route-level data requirements
- Page composition
- Route-level metadata
- Route-specific error handling

Keep business logic outside the route whenever possible.

### Preferred

```text
routes/
└── _app/
    └── courses/
        └── $courseId/
            └── edit.tsx

features/
└── courses/
    ├── components/
    ├── hooks/
    ├── schemas/
    └── server/
```

The route should compose the course-builder feature rather than implement the entire feature.

---

# 4. Course Builder Features

Organize business functionality by **course-builder domain**.

Examples:

```text
features/
├── courses/
├── lessons/
├── sections/
├── assessments/
├── media/
├── publishing/
└── ...
```

Do not organize the application primarily around technical categories such as:

```text
components/
services/
controllers/
repositories/
```

Business domains should be the primary organizational boundary.

---

# 5. Feature Structure

A feature may use the following structure:

```text
features/courses/
├── components/
├── hooks/
├── schemas/
├── server/
└── index.ts
```

Only create the directories needed by the feature.

For example:

```text
features/courses/
├── components/
│   ├── course.card.tsx
│   ├── course.editor.tsx
│   ├── course.form.tsx
│   └── course.list.tsx
│
├── hooks/
│   ├── course.query.ts
│   └── course.mutation.ts
│
├── schemas/
│   └── course.schema.ts
│
├── server/
│   ├── course.create.ts
│   ├── course.update.ts
│   ├── course.delete.ts
│   └── course.publish.ts
│
└── index.ts
```

---

# 6. Dot-Based Naming Convention

Use **dot-separated semantic names** for application files.

The preferred pattern is:

```text
<domain>.<purpose>.<extension>
```

Examples:

```text
course.editor.tsx
course.card.tsx
course.form.tsx
course.schema.ts
course.types.ts
course.validation.ts
course.create.ts
course.update.ts
course.delete.ts
```

For more specific modules:

```text
course.editor.header.tsx
course.editor.sidebar.tsx
course.editor.toolbar.tsx
course.editor.settings.tsx
```

Avoid kebab-case names such as:

```text
course-editor.tsx
course-card.tsx
course-schema.ts
```

Prefer:

```text
course.editor.tsx
course.card.tsx
course.schema.ts
```

---

# 7. React Component Naming

Use PascalCase for React component names while keeping filenames dot-based.

For example:

```text
course.editor.tsx
```

```tsx
export function CourseEditor() {
  // ...
}
```

Additional examples:

```text
lesson.editor.tsx
section.editor.tsx
assessment.builder.tsx
course.card.tsx
course.sidebar.tsx
```

---

# 8. Course Editor Organization

The course editor is a major part of the application and should be organized clearly.

Prefer:

```text
features/courses/
├── components/
│   ├── course.editor.tsx
│   ├── course.editor.header.tsx
│   ├── course.editor.sidebar.tsx
│   ├── course.editor.toolbar.tsx
│   └── course.editor.settings.tsx
│
├── hooks/
│   ├── course.editor.ts
│   └── course.editor.state.ts
│
└── ...
```

Do not put the entire course editor into one large component.

Break the editor into logical components when complexity warrants it.

---

# 9. Lesson Builder

Lesson-specific functionality belongs under:

```text
features/lessons/
```

Example:

```text
features/lessons/
├── components/
│   ├── lesson.editor.tsx
│   ├── lesson.form.tsx
│   ├── lesson.content.tsx
│   └── lesson.preview.tsx
│
├── hooks/
│   └── lesson.editor.ts
│
├── schemas/
│   └── lesson.schema.ts
│
└── server/
    ├── lesson.create.ts
    ├── lesson.update.ts
    └── lesson.delete.ts
```

---

# 10. Section Management

Section-specific functionality belongs under:

```text
features/sections/
```

Examples:

```text
section.editor.tsx
section.card.tsx
section.form.tsx
section.schema.ts
section.create.ts
section.update.ts
```

Sections should not contain course-wide functionality that belongs in `features/courses/`.

---

# 11. Assessment Builder

Assessment functionality belongs under:

```text
features/assessments/
```

Example:

```text
features/assessments/
├── components/
│   ├── assessment.builder.tsx
│   ├── assessment.form.tsx
│   ├── question.editor.tsx
│   └── question.list.tsx
│
├── hooks/
├── schemas/
└── server/
```

Keep assessment-specific logic within this feature.

---

# 12. Media Management

Media-related course-builder functionality belongs under:

```text
features/media/
```

Examples:

```text
media.uploader.tsx
media.library.tsx
media.preview.tsx
media.schema.ts
media.upload.ts
media.delete.ts
```

Do not place media-specific business logic in generic components.

---

# 13. Publishing

Publishing functionality belongs under:

```text
features/publishing/
```

Examples:

```text
publishing.panel.tsx
publishing.status.tsx
publishing.validation.ts
publishing.publish.ts
publishing.unpublish.ts
```

Publishing logic should remain separate from the course editor UI where practical.

---

# 14. Global Components

Use:

```text
src/components/
```

for components shared across multiple course-builder features.

Structure:

```text
components/
├── ui/
├── layout/
└── common/
```

### UI

Generic design-system components:

```text
button.tsx
dialog.tsx
input.tsx
dropdown.menu.tsx
tabs.tsx
```

These must not contain course-specific business logic.

### Layout

Application layout components:

```text
app.header.tsx
app.sidebar.tsx
app.layout.tsx
dashboard.layout.tsx
```

### Common

Reusable application-level components:

```text
empty.state.tsx
loading.state.tsx
error.state.tsx
confirmation.dialog.tsx
```

---

# 15. Generic Utilities

Use:

```text
src/lib/
```

for generic application-level utilities.

Examples:

```text
lib/
├── auth.ts
├── env.ts
├── http.ts
└── utils.ts
```

Do not use `lib/` as a dumping ground.

If functionality clearly belongs to a course-builder feature, put it under that feature.

Avoid vague files such as:

```text
helpers.ts
misc.ts
stuff.ts
common.ts
```

Prefer domain-specific names:

```text
course.permissions.ts
course.formatter.ts
course.validation.ts
```

---

# 16. Server Code

Application-wide server-only functionality belongs under:

```text
src/server/
```

Example:

```text
server/
├── functions/
├── middleware/
└── utils/
```

Feature-specific server functionality should remain within its feature:

```text
features/courses/server/
features/lessons/server/
features/assessments/server/
features/publishing/server/
```

Never expose server-only modules to client-side code.

---

# 17. Schemas and Validation

Use explicit domain names.

Preferred:

```text
course.schema.ts
lesson.schema.ts
section.schema.ts
assessment.schema.ts
publishing.schema.ts
```

For validation-specific functionality:

```text
course.validation.ts
lesson.validation.ts
publishing.validation.ts
```

Avoid unnecessarily generic names such as:

```text
schema.ts
validation.ts
types.ts
```

when the domain is not obvious from the surrounding context.

---

# 18. Tests

Follow the same dot-based naming convention.

Examples:

```text
course.editor.test.tsx
course.schema.test.ts
course.create.test.ts
lesson.editor.test.tsx
assessment.builder.test.tsx
```

Integration tests:

```text
course.create.integration.test.ts
course.publish.integration.test.ts
```

End-to-end tests:

```text
course.creation.e2e.ts
course.publishing.e2e.ts
```

---

# 19. Dependency Rules

Maintain a clear dependency direction:

```text
routes
   ↓
features
   ↓
lib / integrations
```

Routes should depend on features.

Features may use shared application infrastructure.

Avoid circular dependencies.

Avoid making one feature depend directly on another feature's internal implementation unless there is a strong architectural reason.

Prefer public feature exports:

```text
features/courses/index.ts
```

instead of importing internal implementation files directly.

---

# 20. Avoid Over-Engineering

Do not automatically introduce:

```text
repositories/
services/
controllers/
managers/
factories/
adapters/
```

for every feature.

Create an abstraction only when it provides a real benefit.

Prefer simple, explicit code over unnecessary architectural layers.

---

# 21. Before Creating a File

Before creating a new file:

1. Search for existing functionality that solves the same problem.
2. Determine which course-builder feature owns the functionality.
3. Check whether an existing component/module can be extended.
4. Follow the dot-based naming convention.
5. Avoid duplicating business logic.
6. Keep route files thin.
7. Do not reorganize unrelated code unnecessarily.

---

# 22. File Placement Rules

Use the following decision process.

### Is it a route concern?

```text
routes/
```

### Is it course-builder business functionality?

```text
features/<domain>/
```

### Is it a globally reusable UI component?

```text
components/
```

### Is it generic application infrastructure?

```text
lib/
```

### Is it server-only application infrastructure?

```text
server/
```

### Is it an external integration?

```text
integrations/
```

---

# 23. Final Rules

Always prioritize:

1. **Feature ownership**
2. **Clear separation of routing and business logic**
3. **Dot-based semantic filenames**
4. **Small, focused modules**
5. **Reusable components where reuse is real**
6. **Minimal unnecessary abstraction**
7. **Consistent naming and structure**

Use TanStack Router's required file naming conventions for route discovery even though the rest of the application uses dot-based naming.

When uncertain where code belongs, first determine **which course-builder domain owns the behavior**, then place the implementation inside that feature.
tanstackIntent:

- id: "@tanstack/ai#ai-core"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/ai#ai-core"
  for: "Entry point for TanStack AI skills. Routes to chat-experience, tool-calling, media-generation, structured-outputs, adapter-configuration, ag-ui-protocol, middleware, locks, custom-backend-integration, and debug-logging, plus the skills shipped by companion packages (@tanstack/ai-persistence, @tanstack/ai-code-mode). Use chat() not streamText(), openaiText() not createOpenAI(), toServerSentEventsResponse() not manual SSE, middleware hooks not onEnd callbacks."
- id: "@tanstack/ai#ai-core/adapter-configuration"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/ai#ai-core/adapter-configuration"
  for: "Provider adapter selection and configuration: openaiText, anthropicText, geminiText, ollamaText, grokText, groqText, openRouterText, bedrockText, byteplusText, openaiCompatible. Per-model type safety with modelOptions, reasoning/thinking configuration, runtime adapter switching, extendAdapter() for custom models, createModel(). Generic OpenAI-compatible providers (DeepSeek, Together, Fireworks, etc.) via openaiCompatible({ baseURL, apiKey, models }) from @tanstack/ai-openai/compatible. API key env vars: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY/GEMINI_API_KEY, XAI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, OLLAMA_HOST, BEDROCK_API_KEY (or AWS_BEARER_TOKEN_BEDROCK). BytePlus needs TWO keys: ARK_API_KEY (ModelArk — chat/video/image) and BYTEPLUS_VOICE_API_KEY (Seed Speech — TTS/transcription); neither is a fallback for the other."
- id: "@tanstack/ai#ai-core/ag-ui-protocol"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/ai#ai-core/ag-ui-protocol"
  for: "Server-side AG-UI streaming protocol implementation: StreamChunk event types (RUN_STARTED, TEXT_MESSAGE_START/CONTENT/END, TOOL_CALL_START/ARGS/END, RUN_FINISHED, RUN_ERROR, STEP_STARTED/STEP_FINISHED, STATE_SNAPSHOT/DELTA, CUSTOM), toServerSentEventsStream() for SSE format, toHttpStream() for NDJSON format. For backends serving AG-UI events without client packages."
- id: "@tanstack/ai#ai-core/chat-experience"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/ai#ai-core/chat-experience"
  for: "End-to-end chat implementation: server endpoint with chat() and toServerSentEventsResponse(), client-side useChat hook with fetchServerSentEvents(), message rendering with UIMessage parts, multimodal content, thinking/reasoning display. Covers streaming states, connection adapters, and message format conversions. NOT Vercel AI SDK — uses chat() not streamText()."
- id: "@tanstack/ai#ai-core/client-persistence"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/ai#ai-core/client-persistence"
  for: "Browser chat persistence on useChat / ChatClient: localStoragePersistence, sessionStoragePersistence, indexedDBPersistence. Client-authoritative (adapter, full transcript) vs server-authoritative (persistence: true, no client cache). Reload restore, pending interrupts, mid-stream rejoin with delivery durability. Use for SPA reload durability — NOT server history alone. Also covers generation hooks (useGenerateImage etc.), which take only the server-driven mode: persistence: true hydrates the last generation for the (REQUIRED) threadId from the server on mount and repaints status/result/error, nothing is cached in the browser. No extra package: the adapters ship in the framework packages."
- id: "@tanstack/ai#ai-core/custom-backend-integration"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/ai#ai-core/custom-backend-integration"
  for: "Connect useChat to a non-TanStack-AI backend through custom connection adapters. ConnectConnectionAdapter (single async iterable) vs SubscribeConnectionAdapter (separate subscribe/send). Customize fetchServerSentEvents() and fetchHttpStream() with auth headers, custom URLs, and request options. Import from framework package, not @tanstack/ai-client."
- id: "@tanstack/ai#ai-core/debug-logging"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/ai#ai-core/debug-logging"
  for: "Pluggable, category-toggleable debug logging for TanStack AI activities. Toggle with `debug: true | false | DebugConfig` on chat(), summarize(), generateImage(), generateSpeech(), generateTranscription(), generateVideo(). Categories: request, provider, output, middleware, tools, agentLoop, config, errors. Pipe into pino/winston/etc via `debug: { logger }`. Errors log by default even when `debug` is omitted; silence with `debug: false`."
- id: "@tanstack/ai#ai-core/locks"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/ai#ai-core/locks"
  for: "LockStore, InMemoryLockStore, LocksCapability and withLocks for multi-instance coordination in TanStack AI. Ships in @tanstack/ai — NOT in @tanstack/ai-persistence. Separate from AIPersistence state stores — not a stores key, not composable. InMemoryLockStore vs a distributed (e.g. Cloudflare Durable Object) lock, lease recovery, AbortSignal in critical sections. Use when sandbox or other middleware needs cross-worker mutual exclusion — NOT for storing messages/runs (use withPersistence)."
- id: "@tanstack/ai#ai-core/media-generation"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/ai#ai-core/media-generation"
  for: "Image, audio, video, speech (TTS), and transcription generation using activity-specific adapters: generateImage() with openaiImage/geminiImage/byteplusImage, generateAudio() with geminiAudio/falAudio, generateVideo() with async polling (openaiVideo/geminiVideo/grokVideo/falVideo/byteplusVideo, per-model typed durations), generateSpeech() with openaiSpeech/byteplusSpeech, generateTranscription() with openaiTranscription/byteplusTranscription. React hooks: useGenerateImage, useGenerateAudio, useGenerateSpeech, useTranscription, useGenerateVideo. TanStack Start server function integration with toServerSentEventsResponse."
- id: "@tanstack/ai#ai-core/middleware"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/ai#ai-core/middleware"
  for: "Chat lifecycle middleware hooks: onConfig, onStart, onChunk, onBeforeToolCall, onAfterToolCall, onUsage, onFinish, onAbort, onError. Use for analytics, event firing, tool caching (toolCacheMiddleware), logging, and tracing. Middleware array in chat() config, left-to-right execution order. NOT onEnd/onFinish callbacks on chat() — use middleware."
- id: "@tanstack/ai#ai-core/structured-outputs"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/ai#ai-core/structured-outputs"
  for: "Type-safe JSON schema responses from LLMs using outputSchema on chat() and useChat(). Supports Zod, ArkType, and Valibot schemas. The adapter handles provider-specific strategies transparently — never configure structured output at the provider level. Pass stream:true alongside outputSchema for incremental JSON deltas + a terminal validated object via the `structured-output.complete` event. Every assistant turn in useChat carries its own typed `StructuredOutputPart` on `messages[i].parts`, so multi-turn structured chats preserve history automatically — partial/final derive from the latest assistant turn's part. convertSchemaToJsonSchema() for manual schema conversion."
- id: "@tanstack/ai#ai-core/tool-calling"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/ai#ai-core/tool-calling"
  for: "Isomorphic tool system: toolDefinition() with Zod schemas, .server() and .client() implementations, passing tools to both chat() on server and useChat/clientTools on client, tool approval flows with needsApproval and bound interrupts (resolveInterrupt), lazy tool discovery with lazy:true, rendering ToolCallPart and ToolResultPart in UI."
- id: "@tanstack/devtools#devtools-app-setup"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools#devtools-app-setup"
  for: "Install TanStack Devtools, pick framework adapter (React/Vue/Solid/Preact), register plugins via plugins prop, configure shell (position, hotkeys, theme, hideUntilHover, requireUrlFlag, eventBusConfig). TanStackDevtools component, defaultOpen, localStorage persistence."
- id: "@tanstack/devtools#devtools-marketplace"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools#devtools-marketplace"
  for: "Publish plugin to npm and submit to TanStack Devtools Marketplace. PluginMetadata registry format, plugin-registry.ts, pluginImport (importName, type), requires (packageName, minVersion), framework tagging, multi-framework submissions, featured plugins."
- id: "@tanstack/devtools#devtools-plugin-panel"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools#devtools-plugin-panel"
  for: "Build devtools panel components that display emitted event data. Listen via EventClient.on(), handle theme (light/dark), use @tanstack/devtools-ui components. Plugin registration (name, render, id, defaultOpen), lifecycle (mount, activate, destroy), max 3 active plugins. Two paths: Solid.js core with devtools-ui for multi-framework support, or framework-specific panels."
- id: "@tanstack/devtools#devtools-production"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools#devtools-production"
  for: "Handle devtools in production vs development. removeDevtoolsOnBuild, devDependency vs regular dependency, conditional imports, NoOp plugin variants for tree-shaking, non-Vite production exclusion patterns."
- id: "@tanstack/devtools-event-client#devtools-bidirectional"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools-event-client#devtools-bidirectional"
  for: "Two-way event patterns between devtools panel and application. App-to-devtools observation, devtools-to-app commands, time-travel debugging with snapshots and revert. structuredClone for snapshot safety, distinct event suffixes for observation vs commands, serializable payloads only."
- id: "@tanstack/devtools-event-client#devtools-event-client"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools-event-client#devtools-event-client"
  for: "Create typed EventClient for a library. Define event maps with typed payloads, pluginId auto-prepend namespacing, emit()/on()/onAll()/onAllPluginEvents() API. Connection lifecycle (5 retries, 300ms), event queuing, enabled/disabled state, SSR fallbacks, singleton pattern. Unique pluginId requirement to avoid event collisions."
- id: "@tanstack/devtools-event-client#devtools-instrumentation"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools-event-client#devtools-instrumentation"
  for: "Analyze library codebase for critical architecture and debugging points, add strategic event emissions. Identify middleware boundaries, state transitions, lifecycle hooks. Consolidate events (1 not 15), debounce high-frequency updates, DRY shared payload fields, guard emit() for production. Transparent server/client event bridging."
- id: "@tanstack/devtools-vite#devtools-vite-plugin"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools-vite#devtools-vite-plugin"
  for: "Configure @tanstack/devtools-vite for source inspection (data-tsd-source, inspectHotkey, ignore patterns), console piping (client-to-server, server-to-client, levels), enhanced logging, server event bus (port, host, HTTPS), production stripping (removeDevtoolsOnBuild), editor integration (launch-editor, custom editor.open). Must be FIRST plugin in Vite config. Vite ^6 || ^7 only."
- id: "@tanstack/react-start#lifecycle/migrate-from-nextjs"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/react-start#lifecycle/migrate-from-nextjs"
  for: "Step-by-step migration from Next.js App Router to TanStack Start: route definition conversion, API mapping, server function conversion from Server Actions, middleware conversion, data fetching pattern changes."
- id: "@tanstack/react-start#react-start"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/react-start#react-start"
  for: "React bindings for TanStack Start: createStart, StartClient, StartServer, React-specific imports, re-exports from @tanstack/react-router, full project setup with React, useServerFn hook."
- id: "@tanstack/react-start#react-start/server-components"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/react-start#react-start/server-components"
  for: "Implement, review, debug, and refactor TanStack Start React Server Components in React 19 apps. Use when tasks mention @tanstack/react-start/rsc, renderServerComponent, createCompositeComponent, CompositeComponent, renderToReadableStream, createFromReadableStream, createFromFetch, Composite Components, React Flight streams, loader or query owned RSC caching, router.invalidate, structuralSharing: false, selective SSR, stale names like renderRsc or .validator, or migration from Next App Router RSC patterns. Do not use for generic SSR or non-TanStack RSC frameworks except brief comparison."
- id: "@tanstack/router-core#router-core"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core"
  for: "Framework-agnostic core concepts for TanStack Router: route trees, createRouter, createRoute, createRootRoute, createRootRouteWithContext, addChildren, Register type declaration, route matching, route sorting, file naming conventions. Entry point for all router skills."
- id: "@tanstack/router-core#router-core/auth-and-guards"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/auth-and-guards"
  for: "Route protection with beforeLoad, redirect()/throw redirect(), isRedirect helper, authenticated layout routes (_authenticated), non-redirect auth (inline login), RBAC with roles and permissions, auth provider integration (Auth0, Clerk, Supabase), router context for auth state."
- id: "@tanstack/router-core#router-core/code-splitting"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/code-splitting"
  for: "Automatic code splitting (autoCodeSplitting), .lazy.tsx convention, createLazyFileRoute, createLazyRoute, lazyRouteComponent, getRouteApi for typed hooks in split files, codeSplitGroupings per-route override, splitBehavior programmatic config, critical vs non-critical properties."
- id: "@tanstack/router-core#router-core/data-loading"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/data-loading"
  for: "Route loader option, loaderDeps for cache keys, staleTime/gcTime/ defaultPreloadStaleTime SWR caching, pendingComponent/pendingMs/ pendingMinMs, errorComponent/onError/onCatch, beforeLoad, router context and createRootRouteWithContext DI pattern, router.invalidate, Await component, deferred data loading with unawaited promises."
- id: "@tanstack/router-core#router-core/navigation"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/navigation"
  for: "Link component, useNavigate, Navigate component, router.navigate, ToOptions/NavigateOptions/LinkOptions, from/to relative navigation, activeOptions/activeProps, preloading (intent/viewport/render), preloadDelay, navigation blocking (useBlocker, Block), createLink, linkOptions helper, scroll restoration, MatchRoute."
- id: "@tanstack/router-core#router-core/not-found-and-errors"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/not-found-and-errors"
  for: "notFound() function, notFoundComponent, defaultNotFoundComponent, notFoundMode (fuzzy/root), errorComponent, CatchBoundary, CatchNotFound, isNotFound, NotFoundRoute (deprecated), route masking (mask option, createRouteMask, unmaskOnReload)."
- id: "@tanstack/router-core#router-core/path-params"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/path-params"
  for: "Dynamic path segments ($paramName), splat routes ($ / _splat), optional params ({-$paramName}), prefix/suffix patterns ({$param}.ext), useParams, params.parse/stringify, pathParamsAllowedCharacters, i18n locale patterns."
- id: "@tanstack/router-core#router-core/search-params"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/search-params"
  for: "validateSearch, search param validation with Zod/Valibot/ArkType adapters, fallback(), search middlewares (retainSearchParams, stripSearchParams), custom serialization (parseSearch, stringifySearch), search param inheritance, loaderDeps for cache keys, reading and writing search params."
- id: "@tanstack/router-core#router-core/ssr"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/ssr"
  for: "Non-streaming and streaming SSR, RouterClient/RouterServer, renderRouterToString/renderRouterToStream, createRequestHandler, defaultRenderHandler/defaultStreamHandler, HeadContent/Scripts components, head route option (meta/links/styles/scripts), ScriptOnce, automatic loader dehydration/hydration, memory history on server, data serialization, document head management."
- id: "@tanstack/router-core#router-core/type-safety"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/type-safety"
  for: "Full type inference philosophy (never cast, never annotate inferred values), Register module declaration, from narrowing on hooks and Link, strict:false for shared components, getRouteApi for code-split typed access, addChildren with object syntax for TS perf, LinkProps and ValidateLinkOptions type utilities, as const satisfies pattern."
- id: "@tanstack/router-plugin#router-plugin"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-plugin#router-plugin"
  for: "TanStack Router bundler plugin for route generation and automatic code splitting. Supports Vite, Webpack, Rspack, and esbuild. Configures autoCodeSplitting, routesDirectory, target framework, and code split groupings."
- id: "@tanstack/start-client-core#start-core"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/start-client-core#start-core"
  for: "Core overview for TanStack Start: tanstackStart() Vite plugin, getRouter() factory, root route document shell (HeadContent, Scripts, Outlet), client/server entry points, routeTree.gen.ts, tsconfig configuration. Entry point for all Start skills."
- id: "@tanstack/start-client-core#start-core/auth-server-primitives"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/start-client-core#start-core/auth-server-primitives"
  for: "Server-side authentication primitives for TanStack Start: session cookies (HttpOnly, Secure, SameSite, __Host- prefix), session read/issue/destroy via createServerFn and middleware, OAuth authorization-code flow with state and PKCE, password-reset enumeration defense, CSRF for non-GET RPCs, rate limiting auth endpoints, session rotation on privilege change. Pairs with router-core/auth-and-guards for the routing side."
- id: "@tanstack/start-client-core#start-core/deployment"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/start-client-core#start-core/deployment"
  for: "Deploy to Cloudflare Workers, Netlify, Vercel, Node.js/Docker, Bun, Railway. Selective SSR (ssr option per route), SPA mode, static prerendering, ISR with Cache-Control headers, SEO and head management."
- id: "@tanstack/start-client-core#start-core/execution-model"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/start-client-core#start-core/execution-model"
  for: "Isomorphic-by-default principle, environment boundary functions (createServerFn, createServerOnlyFn, createClientOnlyFn, createIsomorphicFn), ClientOnly component, useHydrated hook, import protection, dead code elimination, environment variable safety (VITE_ prefix, process.env)."
- id: "@tanstack/start-client-core#start-core/middleware"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/start-client-core#start-core/middleware"
  for: "createMiddleware, request middleware (.server only), server function middleware (.client + .server), context passing via next({ context }), sendContext for client-server transfer, global middleware via createStart in src/start.ts, middleware factories, method order enforcement, fetch override precedence."
- id: "@tanstack/start-client-core#start-core/server-functions"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/start-client-core#start-core/server-functions"
  for: "createServerFn (GET/POST), validator (Zod or function), useServerFn hook, server context utilities (getRequest, getRequestHeader, setResponseHeader, setResponseStatus), error handling (throw errors, redirect, notFound), streaming, FormData handling, file organization (.functions.ts, .server.ts)."
- id: "@tanstack/start-client-core#start-core/server-routes"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/start-client-core#start-core/server-routes"
  for: "Server-side API endpoints using the server property on createFileRoute, HTTP method handlers (GET, POST, PUT, DELETE), createHandlers for per-handler middleware, handler context (request, params, context), request body parsing, response helpers, file naming for API routes."
- id: "@tanstack/start-server-core#start-server-core"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/start-server-core#start-server-core"
  for: "Server-side runtime for TanStack Start: createStartHandler, request/response utilities (getRequest, setResponseHeader, setCookie, getCookie, useSession), three-phase request handling, AsyncLocalStorage context."
- id: "@tanstack/virtual-file-routes#virtual-file-routes"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/virtual-file-routes#virtual-file-routes"
  for: "Programmatic route tree building as an alternative to filesystem conventions: rootRoute, index, route, layout, physical, defineVirtualSubtreeConfig. Use with TanStack Router plugin's virtualRouteConfig option."
- id: "dotenv#dotenv"
  run: "pnpm dlx @tanstack/intent@latest load dotenv#dotenv"
  for: "Load environment variables from a .env file into process.env for Node.js applications. Use when configuring apps with secrets, setting up local development environments, managing API keys and database uRLs, parsing .env file contents, or populating environment variables programmatically. Always use this skill when the user mentions .env, even for simple tasks like \"set up dotenv\" — the skill contains critical gotchas (encrypted keys, variable expansion, command substitution) that prevent common production issues."
- id: "dotenv#dotenvx"
  run: "pnpm dlx @tanstack/intent@latest load dotenv#dotenvx"
  for: "Use dotenvx to run commands with environment variables, manage multiple .env files, expand variables, and encrypt env files for safe commits and CI/CD."

<!-- intent-skills:end -->
