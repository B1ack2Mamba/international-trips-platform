# v20.1 — builder studio fullscreen

Эта версия не меняет логику canvas. Она меняет режим работы экрана `/dashboard/spaces`.

## Что сделано

- для `/dashboard/spaces` включён отдельный **studio mode**;
- скрыт обычный dashboard chrome: левая пользовательская навигация и верхняя карточка рабочей зоны;
- builder растягивается почти на весь viewport;
- canvas получает всю доступную высоту;
- добавлен переключатель **«Скрыть библиотеку»**, чтобы отдать всю ширину самому полю;
- добавлена кнопка **«Во весь экран»** через browser fullscreen API.

## Зачем

Экран сборки — это не пользовательский модуль, а служебная студия проектирования структуры.
Поэтому он не должен жить в тесной колонке обычной dashboard-страницы.

## Затронутые файлы

- `app/dashboard/spaces/layout.tsx`
- `components/builder-studio-mode.tsx`
- `components/workspace-constructor.tsx`
- `app/globals.css`
