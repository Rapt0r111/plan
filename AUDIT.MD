• ## Anti-pattern verdict: FAIL

  Интерфейс местами выглядит AI-generated: 14 цветных боковых полос, 60 uppercase/tracked labels, 40 blur-эффектов, 76
  glow-паттернов и избыточная motion-стилизация.

  ## Audit Health Score

   Dimension        Score    Key finding
  ━━━━━━━━━━━━━━━  ━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Accessibility      2/4    Низкий контраст и слабая клавиатурная доступность
  ───────────────  ───────  ───────────────────────────────────────────────────
   Performance        2/4    Blur и compositor layers на карточках
  ───────────────  ───────  ───────────────────────────────────────────────────
   Responsive         2/4    Горизонтальные рабочие области и мелкие targets
  ───────────────  ───────  ───────────────────────────────────────────────────
   Theming            2/4    Токены есть, но много жёстких светлых значений
  ───────────────  ───────  ───────────────────────────────────────────────────
   Anti-patterns      1/4    Glass/glow/side-stripe эстетика
  ───────────────  ───────  ───────────────────────────────────────────────────
   Total             9/20    Poor — требуется системный проход

  Найдено: P0: 0 · P1: 5 · P2: 4 · P3: 0

  ## P1 — исправить до выпуска

  ### 1. Muted-текст не соответствует WCAG AA

  - Location: app/globals.css:73-75, 167-169
  - Вычисленный контраст --text-muted:
      - тёмная тема: 3.22:1
      - светлая тема: 2.38:1

  - Токен применяется к тексту размером 9–12px по всему приложению.
  - Impact: подписи, метаданные и placeholder-текст плохо читаются.
  - Standard: WCAG 1.4.3.
  - Command: $impeccable colorize

  ### 2. Модальные окна не удерживают фокус

  - Locations:
    features/create/CreateTaskModal.tsx:253-327
    features/create/CreateEpicModal.tsx:171-249
    features/task-details/TaskSlideover.tsx:248-284
    features/timeline/ui/EpicModal.tsx:156-165

  - Нет полноценного dialog, focus trap и возврата фокуса. Несколько icon-only close-кнопок не имеют accessible name.
  - Impact: клавиатурный пользователь может уйти за модальное окно; screen reader не получает контекст.
  - Standard: WCAG 2.1.1, 2.4.3, 4.1.2.
  - Command: $impeccable harden

  ### 3. Ключевые операции частично pointer-only

  - BoardTaskCard.tsx:231-240 — фокусируемый кликабельный div, но без роли и локального Enter/Space.
  - PersonalPlanBoard.tsx:212, 1022-1034 — сортировка использует только PointerSensor.
  - Impact: карточки и порядок сотрудников недоступны части клавиатурных пользователей.
  - Command: $impeccable harden

  ### 4. Интерактивные цели меньше 24×24px

  - PersonalPlanBoard.tsx:1106-1113, 1386-1399 — 20×20px.
  - AssigneeManager.tsx:78-80 — 16×16px.
  - OperativeDndList.tsx:94-98 — 20×20px.
  - Impact: ошибки на touch-устройствах и при моторных ограничениях.
  - Standard: WCAG 2.5.8.
  - Command: $impeccable adapt

  ### 5. Blur применяется к каждой карточке доски

  - Location: widgets/board/BoardTaskCard.tsx:244-269
  - Каждая карточка создаёт backdrop-filter: blur(14px) и постоянный will-change.
  - Performance mode отключает только CSS-классы blur (globals.css:1139-1147), но не inline-стиль карточки.
  - Impact: лишние compositing layers, GPU readback и падение FPS на слабых ноутбуках.
  - Command: $impeccable optimize

  ## P2 — следующий проход

  1. Theme drift: жёсткие rgba(255,255,255,…) в PersonalPlanBoard.tsx и других компонентах плохо адаптируются к светлой
     теме.
     Command: $impeccable colorize

  2. Mobile workflow: календари используют области min-w-[980px] и min-w-[1180px] с горизонтальным скроллом. Это не
     ломает страницу, но делает мобильную работу тяжёлой.
     Command: $impeccable adapt

  3. Visual noise: цветные side-stripes, glow, glass и повторяющиеся uppercase labels конкурируют с рабочими
     состояниями.
     Command: $impeccable quieter

  4. Font loading: Google Fonts подключены блокирующим CSS @import в app/globals.css:15, вместо локальной/Next.js-
     оптимизированной загрузки.
     Command: $impeccable optimize

  ## Что сделано хорошо

  - Глобально поддерживается prefers-reduced-motion.
  - Есть отдельный performance mode.
  - SSE refresh уже debounce’ится.
  - Оперативные DnD-потоки используют KeyboardSensor.
  - /today имеет хорошие landmarks, focus rings и клавиатурную навигацию.
  - Scoped ESLint для app, widgets, features, shared проходит без предупреждений.
  - Файлы не изменялись; рабочее дерево чистое.

  ## Рекомендуемый порядок

  1. [P1] $impeccable harden — модальные окна и клавиатурные операции.
  2. [P1] $impeccable colorize — контраст токенов обеих тем.
  3. [P1] $impeccable optimize — blur, layers и layout-анимации.
  4. [P1] $impeccable adapt — targets и мобильные таблицы.
  5. [P2] $impeccable quieter — убрать AI-визуальные паттерны.
  6. $impeccable polish — финальная унификация.

  You can ask me to run these one at a time, all at once, or in any order you prefer.

  Re-run $impeccable audit after fixes to see your score improve.
