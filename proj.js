"use strict";

const STORAGE_KEY = "daymark-tasks";
const STORAGE_NOTE_KEY = "daymark-focus-note";
const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };
const page = document.body.dataset.page;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let tasks = loadTasks();
let activeFilter = "all";
let editingTaskId = null;
let statusTimer;
let timerInterval;
let customDurationSelected = false;
let timerState = { mode: "pomodoro", duration: 5 * 60, remaining: 5 * 60, elapsed: 0, running: false, startedAt: 0, base: 0, taskId: "", phase: "focus", breakDuration: 5 * 60 };

function loadTasks() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("tasks");
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error("Task data is not a list.");
        return parsed.map((task, index) => ({
            id: String(task.id ?? `${Date.now()}-${index}`), title: String(task.title || "Untitled task"),
            category: task.category || "Other", priority: PRIORITY_ORDER[task.priority] !== undefined ? task.priority : "Medium",
            dueDate: typeof task.dueDate === "string" ? task.dueDate : "", startTime: typeof task.startTime === "string" ? task.startTime : "", endTime: typeof task.endTime === "string" ? task.endTime : "", completed: Boolean(task.completed),
            focusNote: typeof task.focusNote === "string" ? task.focusNote : "",
            createdAt: Number(task.createdAt) || Date.now() - index
        }));
    } catch (error) { console.error(error); showStatus("Saved tasks could not be loaded."); return []; }
}

function saveTasks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
function showStatus(message) { const status = $("#status-message"); if (!status) return; status.textContent = message; clearTimeout(statusTimer); statusTimer = setTimeout(() => { status.textContent = ""; }, 3500); }
function localDateString(date = new Date()) { const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10); }
function formatDate(value) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`)); }
function formatTime(value) { if (!value) return ""; const [hours, minutes] = value.split(":").map(Number); return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hours, minutes)); }
function isOverdue(task) { return Boolean(task.dueDate && !task.completed && task.dueDate < localDateString()); }

function renderStats() {
    const completed = tasks.filter((task) => task.completed).length;
    const total = tasks.length;
    const rate = total ? Math.round(completed / total * 100) : 0;
    const values = { "#total-count": total, "#pending-count": total - completed, "#completed-count": completed, "#progress-percent": `${rate}%`, "#insight-rate": `${rate}%`, "#overdue-count": tasks.filter(isOverdue).length, "#settings-count": `${total} task${total === 1 ? "" : "s"}` };
    Object.entries(values).forEach(([selector, value]) => { const element = $(selector); if (element) element.textContent = String(value); });
    const fill = $("#progress-fill"); if (fill) fill.style.width = `${rate}%`;
    const caption = $("#progress-caption"); if (caption) caption.textContent = total === 0 ? "Ready when you are." : rate === 100 ? "Everything is complete." : `${total - completed} task${total - completed === 1 ? "" : "s"} still in motion.`;
    const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
    const dueThisWeek = tasks.filter((task) => task.dueDate && task.dueDate >= localDateString() && new Date(`${task.dueDate}T00:00:00`) <= weekEnd).length;
    const weekCount = $("#week-count"); if (weekCount) weekCount.textContent = String(dueThisWeek);
}

function element(tag, className, text) { const item = document.createElement(tag); if (className) item.className = className; if (text !== undefined) item.textContent = text; return item; }
function renderTask(task, allowActions = true) {
    const item = element("article", `task-item${task.completed ? " is-completed" : ""}`);
    const checkbox = element("input", "task-check"); checkbox.type = "checkbox"; checkbox.checked = task.completed; checkbox.setAttribute("aria-label", `${task.completed ? "Reopen" : "Complete"} ${task.title}`); checkbox.addEventListener("change", () => toggleTask(task.id));
    const content = element("div", "task-content"); content.append(element("p", "task-title", task.title));
    const meta = element("div", "task-meta"); meta.append(element("span", "task-tag", task.category), element("span", `priority-tag priority-${task.priority.toLowerCase()}`, `${task.priority} priority`));
    if (task.dueDate || task.startTime || task.endTime) { const dateLabel = task.dueDate ? formatDate(task.dueDate) : "Time set"; const timeLabel = task.startTime && task.endTime ? `${formatTime(task.startTime)} - ${formatTime(task.endTime)}` : task.startTime ? `Starts ${formatTime(task.startTime)}` : task.endTime ? `Ends ${formatTime(task.endTime)}` : ""; meta.append(element("span", `due-tag${isOverdue(task) ? " is-overdue" : ""}`, `${isOverdue(task) ? "Overdue / " : "Due / "}${dateLabel}${timeLabel ? ` / ${timeLabel}` : ""}`)); }
    content.append(meta);
    const actions = element("div", "task-actions");
    if (allowActions) { const edit = element("button", "icon-button", "Edit"); edit.type = "button"; edit.title = "Edit task"; edit.addEventListener("click", () => beginEdit(task)); const remove = element("button", "icon-button delete-button", "X"); remove.type = "button"; remove.title = "Delete task"; remove.addEventListener("click", () => deleteTask(task.id)); actions.append(edit, remove); }
    item.append(checkbox, content, actions); return item;
}

function renderEmpty(container, message = "Your list is clear.") { const empty = element("div", "empty-state"); empty.append(element("div", "empty-icon", "/"), element("h3", "", message), element("p", "", "Add a task when you are ready for the next move.")); container.append(empty); }
function visibleTasks() {
    const query = (($('#search-input')?.value || "").trim()).toLowerCase();
    const filtered = tasks.filter((task) => (activeFilter === "all" || (activeFilter === "completed" ? task.completed : !task.completed)) && `${task.title} ${task.category} ${task.priority}`.toLowerCase().includes(query));
    const sort = $("#sort-select")?.value || "none";
    filtered.sort((a, b) => sort === "high" ? PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] : sort === "low" ? PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority] : sort === "due" ? scheduleKey(a).localeCompare(scheduleKey(b)) : b.createdAt - a.createdAt);
    return filtered;
}
function scheduleKey(task) { return `${task.dueDate || "9999-12-31"}T${task.startTime || "23:59"}`; }
function renderTaskList() {
    const list = $("#task-list"); if (!list) return; list.replaceChildren(); const filtered = visibleTasks(); filtered.forEach((task) => list.append(renderTask(task))); if (!filtered.length) renderEmpty(list, $("#search-input")?.value ? "No matching tasks." : "No tasks in this view.");
    const count = $("#visible-count"); if (count) count.textContent = `${filtered.length} task${filtered.length === 1 ? "" : "s"}`;
    const clear = $("#clear-completed"); if (clear) clear.disabled = !tasks.some((task) => task.completed);
}
function daysUntil(dateValue) { const today = new Date(`${localDateString()}T00:00:00`); const target = new Date(`${dateValue}T00:00:00`); return Math.ceil((target - today) / 86400000); }
function priorityDeadlineTasks() { return tasks.filter((task) => !task.completed && task.dueDate).sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || scheduleKey(a).localeCompare(scheduleKey(b))); }
function renderPriorityDeadline() { const banner = $("#priority-deadline"); if (!banner) return; const task = priorityDeadlineTasks()[0]; const title = $("#priority-title"); const meta = $("#priority-meta"); const days = $("#priority-days"); if (!task) { title.textContent = "No priority deadline yet."; meta.textContent = "Add a pending task with a deadline to see the countdown."; days.textContent = "--"; banner.classList.remove("is-overdue"); return; } const remaining = daysUntil(task.dueDate); title.textContent = task.title; meta.textContent = `${task.priority} priority / Due ${formatDate(task.dueDate)}${task.startTime ? ` at ${formatTime(task.startTime)}` : ""}`; days.textContent = remaining < 0 ? `${Math.abs(remaining)}d late` : remaining === 0 ? "Today" : `${remaining}d left`; banner.classList.toggle("is-overdue", remaining < 0); }
function renderImportantTasks() { const list = $("#important-list"); if (!list) return; list.replaceChildren(); const important = [...tasks].filter((task) => !task.completed).sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || scheduleKey(a).localeCompare(scheduleKey(b)) || b.createdAt - a.createdAt).slice(0, 5); important.forEach((task, index) => { const item = element("article", "notification-item"); const marker = element("span", `notification-marker priority-${task.priority.toLowerCase()}`, String(index + 1).padStart(2, "0")); const body = element("div", "notification-content"); body.append(element("strong", "", task.title)); const detail = element("p", "notification-detail", `${task.category} / ${task.priority} priority${task.dueDate ? ` / ${daysUntil(task.dueDate) < 0 ? "overdue" : `due ${formatDate(task.dueDate)}`}` : " / no deadline"}`); body.append(detail); const action = element("button", "notification-action", "Open"); action.type = "button"; action.addEventListener("click", () => { window.location.href = `tasks.html#add-task`; }); item.append(marker, body, action); list.append(item); }); if (!important.length) renderEmpty(list, "No pending tasks."); }

function toggleTask(id) { const task = tasks.find((item) => item.id === id); if (!task) return; task.completed = !task.completed; saveTasks(); renderAll(); showStatus(task.completed ? "Task completed." : "Task reopened."); }
function deleteTask(id) { tasks = tasks.filter((task) => task.id !== id); saveTasks(); renderAll(); showStatus("Task deleted."); }
function clearCompleted() { tasks = tasks.filter((task) => !task.completed); saveTasks(); renderAll(); showStatus("Completed tasks cleared."); }
function resetForm() { const form = $("#task-form"); if (!form) return; form.reset(); editingTaskId = null; $("#form-heading").textContent = "Add a task"; $("#form-eyebrow").textContent = "NEW ENTRY"; $("#submit-task").textContent = "+ Add task"; $("#cancel-edit").hidden = true; }
function beginEdit(task) { if (!$("#task-form")) return; editingTaskId = task.id; $("#task-title").value = task.title; $("#task-category").value = task.category; $("#task-priority").value = task.priority; $("#task-due-date").value = task.dueDate; $("#task-start-time").value = task.startTime; $("#task-end-time").value = task.endTime; $("#form-heading").textContent = "Edit task"; $("#form-eyebrow").textContent = "UPDATE ENTRY"; $("#submit-task").textContent = "Save changes"; $("#cancel-edit").hidden = false; $("#add-task").scrollIntoView({ behavior: "smooth", block: "start" }); }
function handleSubmit(event) { event.preventDefault(); const title = $("#task-title").value.trim(); if (!title) return; const values = { title, category: $("#task-category").value, priority: $("#task-priority").value, dueDate: $("#task-due-date").value, startTime: $("#task-start-time").value, endTime: $("#task-end-time").value }; const wasEditing = Boolean(editingTaskId); if (wasEditing) Object.assign(tasks.find((task) => task.id === editingTaskId), values); else tasks.push({ ...values, id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, completed: false, createdAt: Date.now() }); saveTasks(); resetForm(); renderAll(); showStatus(wasEditing ? "Task updated." : "Task added."); }
function renderInsights() {
    const renderBars = (target, values) => { const container = $(target); if (!container) return; container.replaceChildren(); const max = Math.max(...values.map((item) => item.count), 1); values.forEach((item) => { const row = element("div", "breakdown-row"); const label = element("div", "breakdown-label"); label.append(element("strong", "", item.label), element("span", "", String(item.count))); const track = element("div", "breakdown-track"); const bar = element("span"); bar.style.width = `${item.count / max * 100}%`; track.append(bar); row.append(label, track); container.append(row); }); };
    const categories = [...new Set(tasks.map((task) => task.category))]; renderBars("#category-breakdown", (categories.length ? categories : ["No categories yet"]).map((label) => ({ label, count: tasks.filter((task) => task.category === label).length })));
    renderBars("#priority-breakdown", ["High", "Medium", "Low"].map((label) => ({ label, count: tasks.filter((task) => task.priority === label).length })));
    const upcoming = $("#upcoming-list"); if (upcoming) { upcoming.replaceChildren(); const due = tasks.filter((task) => task.dueDate && !task.completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5); due.forEach((task) => upcoming.append(renderTask(task, false))); if (!due.length) renderEmpty(upcoming, "No upcoming deadlines."); }
}
function formatTimer(seconds) { const safe = Math.max(0, Math.floor(seconds)); return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`; }
function selectedTimerTaskLabel() { const task = tasks.find((item) => item.id === timerState.taskId); return task ? ` / ${task.title}` : ""; }
function getFocusNoteForSelectedTask() {
    if (!timerState.taskId) return localStorage.getItem(STORAGE_NOTE_KEY) || "";
    const task = tasks.find((item) => item.id === timerState.taskId);
    return task ? (task.focusNote || "") : (localStorage.getItem(STORAGE_NOTE_KEY) || "");
}
function saveFocusNote(value) {
    const trimmed = String(value || "").trim();
    if (timerState.taskId) {
        const task = tasks.find((item) => item.id === timerState.taskId);
        if (task) {
            task.focusNote = trimmed;
            saveTasks();
            return;
        }
    }
    localStorage.setItem(STORAGE_NOTE_KEY, trimmed);
}
function syncFocusNoteField() {
    const field = $("#focus-note"); if (!field) return;
    const meta = $("#focus-note-meta");
    const note = getFocusNoteForSelectedTask();
    field.value = note;
    if (meta) {
        const task = tasks.find((item) => item.id === timerState.taskId);
        meta.textContent = task ? `Saved to ${task.title}.` : "Saved to your current focus session.";
    }
}
function renderTimerTaskOptions() { const select = $("#timer-task"); if (!select) return; const current = timerState.taskId; select.replaceChildren(element("option", "", "No task - free focus")); select.firstChild.value = ""; tasks.filter((task) => !task.completed).sort((a, b) => b.createdAt - a.createdAt).forEach((task) => { const option = element("option", "", task.title); option.value = task.id; select.append(option); }); select.value = tasks.some((task) => task.id === current && !task.completed) ? current : ""; timerState.taskId = select.value; syncFocusNoteField(); }
function renderTimer() { const panel = $("[data-timer-panel]"); if (!panel) return; const mode = $("#timer-mode"); const duration = $("#pomodoro-duration"); const custom = $("#custom-duration"); const display = $("#timer-display"); const start = $("#timer-start"); const phase = $("#timer-phase"); if (mode) mode.value = timerState.mode; if (duration) { duration.hidden = timerState.mode !== "pomodoro"; duration.value = customDurationSelected ? "custom" : String(timerState.duration / 60); } if (custom) custom.hidden = timerState.mode !== "pomodoro" || !customDurationSelected; if (display) display.textContent = timerState.mode === "stopwatch" ? formatTimer(timerState.elapsed) : formatTimer(timerState.remaining); if (start) start.textContent = timerState.running ? "Pause" : "Start"; if (phase) phase.textContent = timerState.mode === "stopwatch" ? `Stopwatch${selectedTimerTaskLabel()}` : timerState.phase === "break" ? `5-minute break${selectedTimerTaskLabel()}` : `Focus session${selectedTimerTaskLabel()}`; panel.classList.toggle("is-running", timerState.running); panel.classList.toggle("is-break", timerState.phase === "break"); }
function resetTimer() { clearInterval(timerInterval); timerState.running = false; timerState.startedAt = 0; timerState.base = 0; timerState.elapsed = 0; timerState.phase = "focus"; timerState.remaining = timerState.duration; renderTimer(); }
function tickTimer() { if (!timerState.running) return; if (timerState.mode === "stopwatch") timerState.elapsed = timerState.base + Math.floor((Date.now() - timerState.startedAt) / 1000); else timerState.remaining = Math.max(0, timerState.remaining - Math.floor((Date.now() - timerState.startedAt) / 1000)); timerState.startedAt = Date.now(); if (timerState.mode === "pomodoro" && timerState.remaining <= 0) { if (timerState.phase === "focus") { timerState.phase = "break"; timerState.remaining = timerState.breakDuration; showStatus(`Focus complete${selectedTimerTaskLabel()}. 5-minute break started.`); } else { clearInterval(timerInterval); timerState.running = false; timerState.phase = "focus"; timerState.remaining = timerState.duration; showStatus("Break complete. Ready for another focus session."); } } renderTimer(); }
function toggleTimer() { if (timerState.running) { tickTimer(); timerState.running = false; clearInterval(timerInterval); if (timerState.mode === "stopwatch") timerState.base = timerState.elapsed; renderTimer(); return; } if (timerState.mode === "pomodoro" && timerState.remaining <= 0) timerState.remaining = timerState.duration; timerState.running = true; timerState.startedAt = Date.now(); timerInterval = setInterval(tickTimer, 1000); renderTimer(); }
function setTimerMode(mode) { timerState.mode = mode; resetTimer(); }
function setTimerDuration(minutes) { const value = Number(minutes); if (!Number.isFinite(value) || value < 1) return; timerState.duration = Math.min(720, Math.round(value)) * 60; resetTimer(); }
function renderAll() { renderStats(); renderTaskList(); renderPriorityDeadline(); renderImportantTasks(); renderInsights(); renderTimerTaskOptions(); renderTimer(); }
function init() {
    $$(`[data-nav="${page}"]`).forEach((link) => link.classList.add("is-active")); const today = $("#today-label"); if (today) today.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date());
    $("#task-form")?.addEventListener("submit", handleSubmit); $("#cancel-edit")?.addEventListener("click", resetForm); $("#search-input")?.addEventListener("input", renderTaskList); $("#sort-select")?.addEventListener("change", renderTaskList); $("#clear-completed")?.addEventListener("click", clearCompleted); $("#pick-task")?.addEventListener("click", () => { const pending = tasks.filter((task) => !task.completed); const result = $("#focus-result"); if (result) { result.textContent = pending.length ? `Start here: ${pending[Math.floor(Math.random() * pending.length)].title}` : "Everything is complete."; result.hidden = false; } }); $("#reset-tasks")?.addEventListener("click", () => { if (tasks.length && confirm("Delete every saved task? This cannot be undone.")) { tasks = []; saveTasks(); renderAll(); showStatus("All task data deleted."); } }); $("#timer-mode")?.addEventListener("change", (event) => setTimerMode(event.target.value)); $("#pomodoro-duration")?.addEventListener("change", (event) => { if (event.target.value === "custom") { customDurationSelected = true; renderTimer(); $("#custom-duration")?.focus(); } else { customDurationSelected = false; setTimerDuration(event.target.value); } }); $("#custom-duration")?.addEventListener("change", (event) => setTimerDuration(event.target.value)); $("#timer-task")?.addEventListener("change", (event) => { timerState.taskId = event.target.value; syncFocusNoteField(); renderTimer(); });
    $("#focus-note")?.addEventListener("input", (event) => {
        saveFocusNote(event.target.value);
        const meta = $("#focus-note-meta");
        if (meta) {
            const task = tasks.find((item) => item.id === timerState.taskId);
            meta.textContent = task ? `Saved to ${task.title}.` : "Saved to your current focus session.";
        }
    }); $("#timer-start")?.addEventListener("click", toggleTimer); $("#timer-reset")?.addEventListener("click", resetTimer); $$(".filter-tab").forEach((tab) => tab.addEventListener("click", () => { activeFilter = tab.dataset.filter; $$(".filter-tab").forEach((item) => item.classList.toggle("is-active", item === tab)); renderTaskList(); })); renderAll();
}
init();
