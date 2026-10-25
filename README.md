# Redline Task Manager

Redline is a dependency-free, browser-based task manager with a black and red interface. It stores tasks in the browser's Local Storage, so the app works offline and does not require a backend.

## Run the app

Open [proj.html](./proj.html) in a modern browser. No install, build step, or server is required.

## Pages

- **Dashboard** (`proj.html`): See totals, completion progress, the highest-priority deadline countdown, and the top five important task notifications.
- **Tasks** (`tasks.html`): Add, edit, complete, delete, search, sort, and filter tasks. Schedule a due date, an optional start time, and an optional end time. End time can be left blank when the finish time is unknown.
- **Timer** (`timer.html`): Use the standalone Pomodoro and Stopwatch workspace with task focus, custom durations, and automatic breaks.
- **Insights** (`insights.html`): Review completion rate, overdue work, weekly deadlines, category distribution, and priority mix.
- **Settings** (`settings.html`): See where data is stored and delete all saved tasks.

## Focus timer

The Timer page includes Pomodoro presets of 5, 10, 30, 60, and 180 minutes, plus a custom duration. A 5-minute break starts automatically after each completed Pomodoro. Stopwatch mode is available for open-ended work. Select a pending task to connect the session to it, or choose **No task - free focus** to run the timer independently.

## Task data

Tasks are saved under the `daymark-tasks` Local Storage key. The app also reads the older `tasks` key when present, allowing existing task data to continue working. Existing tasks without time fields continue to work and are treated as date-only tasks. Data is local to the browser and is not sent to a server.

## Project files

- `proj.html`, `tasks.html`, `timer.html`, `insights.html`, and `settings.html` are the page entry points.
- `proj.css` contains the shared responsive black and red theme.
- `proj.js` contains shared storage, task actions, rendering, and page-specific insights.

## Cleanup

The empty `src` folders and local `.venv` / `node_modules` directories were removed because this project has no Python or Node dependency manifest and runs directly from static files.
