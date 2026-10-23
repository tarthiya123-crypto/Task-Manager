"use strict";

const STORAGE_KEY = "daymark-tasks";
const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };
const elements = {
    taskForm: document.getElementById("task-form"),
    title: document.getElementById("task-title"),
    category: document.getElementById("task-category"),
    priority: document.getElementById("task-priority"),
    dueDate: document.getElementById("task-due-date"),
    submitTask: document.getElementById("submit-task"),
    cancelEdit: document.getElementById("cancel-edit"),
    formHeading: document.getElementById("form-heading"),
    formEyebrow: document.getElementById("form-eyebrow"),
    taskList: document.getElementById("task-list"),
    search: document.getElementById("search-input"),
    sort: document.getElementById("sort-select"),
    filterTabs: document.querySelectorAll(".filter-tab"),
    visibleCount: document.getElementById("visible-count"),
    totalCount: document.getElementById("total-count"),
    pendingCount: document.getElementById("pending-count"),
    completedCount: document.getElementById("completed-count"),
    progressPercent: document.getElementById("progress-percent"),
    progressTrack: document.getElementById("progress-track"),
    progressFill: document.getElementById("progress-fill"),
    progressCaption: document.getElementById("progress-caption"),
    clearCompleted: document.getElementById("clear-completed"),
    pickTask: document.getElementById("pick-task"),
    focusResult: document.getElementById("focus-result"),
    status: document.getElementById("status-message"),
    today: document.getElementById("today-label")
};

let activeFilter = "all";
let editingTaskId = null;
let statusTimer;
let importedLegacyTasks = false;
let tasks = loadTasks();

if (importedLegacyTasks) saveTasks();

function loadTasks() {
    try {
        const savedTasks = localStorage.getItem(STORAGE_KEY);
        if (savedTasks === null) {
            const legacyTasks = localStorage.getItem("tasks");
            if (legacyTasks === null) return [];

            const parsedLegacyTasks = JSON.parse(legacyTasks);
            if (!Array.isArray(parsedLegacyTasks) || !parsedLegacyTasks.every(isLegacyTask)) {
                throw new Error("Previously saved task data has an invalid format.");
            }
            importedLegacyTasks = true;
            showStatus("Your saved tasks have been brought into Daymark.");
            return parsedLegacyTasks.map((task, index) => ({
                id: String(task.id),
                title: task.title,
                category: task.category || "Other",
                priority: Object.hasOwn(PRIORITY_ORDER, task.priority) ? task.priority : "Medium",
                dueDate: "",
                completed: task.completed,
                createdAt: Date.now() - index
            }));
        }

        const parsedTasks = JSON.parse(savedTasks);
        if (!Array.isArray(parsedTasks) || !parsedTasks.every(isValidTask)) {
            throw new Error("Saved task data has an invalid format.");
        }
        return parsedTasks;
    } catch (error) {
        console.error("Could not load saved tasks:", error);
        showStatus("Saved tasks could not be loaded. Your new tasks will still work in this session.");
        return [];
    }
}

function isLegacyTask(task) {
    return task !== null
        && typeof task === "object"
        && (typeof task.id === "string" || typeof task.id === "number")
        && typeof task.title === "string"
        && typeof task.completed === "boolean";
}

function isValidTask(task) {
    return task !== null
        && typeof task === "object"
        && typeof task.id === "string"
        && typeof task.title === "string"
        && typeof task.category === "string"
        && Object.hasOwn(PRIORITY_ORDER, task.priority)
        && typeof task.completed === "boolean"
        && typeof task.createdAt === "number"
        && (task.dueDate === "" || typeof task.dueDate === "string");
}

function saveTasks() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        return true;
    } catch (error) {
        console.error("Could not save tasks:", error);
        showStatus("Your browser could not save these changes. They may be lost when you close this page.");
        return false;
    }
}

function showStatus(message) {
    elements.status.textContent = message;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
        elements.status.textContent = "";
    }, 4200);
}

function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function formatDate(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function renderTask(task) {
    const item = createElement("article", `task-item${task.completed ? " is-completed" : ""}`);
    const checkbox = createElement("input", "task-check");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", `${task.completed ? "Mark as in progress" : "Mark as completed"}: ${task.title}`);
    checkbox.addEventListener("change", () => toggleTask(task.id));

    const content = createElement("div", "task-content");
    content.append(createElement("p", "task-title", task.title));
    const meta = createElement("div", "task-meta");
    meta.append(createElement("span", "task-tag", task.category));
    meta.append(createElement("span", `priority-tag priority-${task.priority.toLowerCase()}`, `${task.priority} priority`));

    if (task.dueDate) {
        const isOverdue = !task.completed && task.dueDate < localDateString();
        const dueTag = createElement("span", `due-tag${isOverdue ? " is-overdue" : ""}`, `${isOverdue ? "Overdue · " : "Due · "}${formatDate(task.dueDate)}`);
        meta.append(dueTag);
    }
    content.append(meta);

    const actions = createElement("div", "task-actions");
    const editButton = createElement("button", "icon-button", "✎");
    editButton.type = "button";
    editButton.title = "Edit task";
    editButton.setAttribute("aria-label", `Edit ${task.title}`);
    editButton.addEventListener("click", () => beginEdit(task));

    const deleteButton = createElement("button", "icon-button delete-button", "×");
    deleteButton.type = "button";
    deleteButton.title = "Delete task";
    deleteButton.setAttribute("aria-label", `Delete ${task.title}`);
    deleteButton.addEventListener("click", () => deleteTask(task.id));
    actions.append(editButton, deleteButton);

    item.append(checkbox, content, actions);
    return item;
}

function renderEmptyState() {
    const empty = createElement("div", "empty-state");
    const icon = createElement("div", "empty-icon", elements.search.value.trim() ? "⌕" : "✓");
    icon.setAttribute("aria-hidden", "true");
    const heading = createElement("h3", "", elements.search.value.trim() ? "No matching tasks" : activeFilter === "completed" ? "Nothing completed yet" : activeFilter === "pending" ? "You’re all caught up" : "Your list is clear");
    const description = createElement("p", "", elements.search.value.trim() ? "Try another search or switch your filters." : activeFilter === "completed" ? "Finish a task and it will show up here." : activeFilter === "pending" ? "Add a task whenever you’re ready for the next one." : "Add your first task to start building momentum.");
    empty.append(icon, heading, description);
    elements.taskList.append(empty);
}

function getVisibleTasks() {
    const query = elements.search.value.trim().toLocaleLowerCase();
    const visibleTasks = tasks.filter((task) => {
        const matchesStatus = activeFilter === "all"
            || (activeFilter === "completed" && task.completed)
            || (activeFilter === "pending" && !task.completed);
        const matchesSearch = `${task.title} ${task.category} ${task.priority}`.toLocaleLowerCase().includes(query);
        return matchesStatus && matchesSearch;
    });

    const sortMode = elements.sort.value;
    if (sortMode === "high" || sortMode === "low") {
        const direction = sortMode === "high" ? 1 : -1;
        visibleTasks.sort((first, second) => direction * (PRIORITY_ORDER[first.priority] - PRIORITY_ORDER[second.priority]) || second.createdAt - first.createdAt);
    } else if (sortMode === "due") {
        visibleTasks.sort((first, second) => {
            if (!first.dueDate) return second.dueDate ? 1 : second.createdAt - first.createdAt;
            if (!second.dueDate) return -1;
            return first.dueDate.localeCompare(second.dueDate) || second.createdAt - first.createdAt;
        });
    } else {
        visibleTasks.sort((first, second) => second.createdAt - first.createdAt);
    }
    return visibleTasks;
}

function render() {
    const completed = tasks.filter((task) => task.completed).length;
    const pending = tasks.length - completed;
    const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
    const visibleTasks = getVisibleTasks();

    elements.totalCount.textContent = String(tasks.length);
    elements.pendingCount.textContent = String(pending);
    elements.completedCount.textContent = String(completed);
    elements.visibleCount.textContent = String(visibleTasks.length);
    elements.progressPercent.textContent = `${progress}%`;
    elements.progressFill.style.width = `${progress}%`;
    elements.progressTrack.setAttribute("aria-valuenow", String(progress));
    elements.progressCaption.textContent = tasks.length === 0
        ? "A fresh start. You’ve got this!"
        : progress === 100 ? "Everything is done. Amazing work!"
            : `${completed} of ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} complete`;
    elements.clearCompleted.disabled = completed === 0;
    elements.taskList.replaceChildren();

    if (visibleTasks.length === 0) {
        renderEmptyState();
    } else {
        visibleTasks.forEach((task) => elements.taskList.append(renderTask(task)));
    }
}

function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function resetForm() {
    elements.taskForm.reset();
    elements.priority.value = "Medium";
    elements.formHeading.textContent = "Add a task";
    elements.formEyebrow.textContent = "LET’S GET IT DONE";
    elements.submitTask.innerHTML = "<span>＋</span> Add task";
    elements.cancelEdit.hidden = true;
    editingTaskId = null;
}

function beginEdit(task) {
    editingTaskId = task.id;
    elements.title.value = task.title;
    elements.category.value = task.category;
    elements.priority.value = task.priority;
    elements.dueDate.value = task.dueDate;
    elements.formHeading.textContent = "Edit task";
    elements.formEyebrow.textContent = "MAKE A QUICK CHANGE";
    elements.submitTask.innerHTML = "<span>✓</span> Save changes";
    elements.cancelEdit.hidden = false;
    elements.title.focus();
    document.querySelector(".form-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function handleSubmit(event) {
    event.preventDefault();
    const title = elements.title.value.trim();
    if (!title) {
        elements.title.setCustomValidity("Enter a task name before saving.");
        elements.title.reportValidity();
        return;
    }
    elements.title.setCustomValidity("");

    if (editingTaskId) {
        tasks = tasks.map((task) => task.id === editingTaskId
            ? { ...task, title, category: elements.category.value, priority: elements.priority.value, dueDate: elements.dueDate.value }
            : task);
        showStatus("Task updated.");
    } else {
        tasks.unshift({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            title,
            category: elements.category.value,
            priority: elements.priority.value,
            dueDate: elements.dueDate.value,
            completed: false,
            createdAt: Date.now()
        });
        showStatus("Task added to your list.");
    }

    saveTasks();
    resetForm();
    render();
}

function toggleTask(taskId) {
    tasks = tasks.map((task) => task.id === taskId ? { ...task, completed: !task.completed } : task);
    saveTasks();
    render();
}

function deleteTask(taskId) {
    tasks = tasks.filter((task) => task.id !== taskId);
    if (editingTaskId === taskId) resetForm();
    saveTasks();
    render();
    showStatus("Task deleted.");
}

function clearCompleted() {
    const completedCount = tasks.filter((task) => task.completed).length;
    if (!completedCount) return;
    tasks = tasks.filter((task) => !task.completed);
    if (editingTaskId && !tasks.some((task) => task.id === editingTaskId)) resetForm();
    saveTasks();
    render();
    showStatus(`${completedCount} completed ${completedCount === 1 ? "task" : "tasks"} cleared.`);
}

function pickFocusTask() {
    const pendingTasks = tasks.filter((task) => !task.completed);
    if (pendingTasks.length === 0) {
        showStatus(tasks.length ? "All tasks are complete. Add a new one to keep going!" : "Add a task first, then we can help you find your focus.");
        return;
    }
    const task = pendingTasks[Math.floor(Math.random() * pendingTasks.length)];
    elements.focusResult.textContent = `Start here: ${task.title}`;
    elements.focusResult.hidden = false;
}

function setFilter(filter) {
    activeFilter = filter;
    elements.filterTabs.forEach((tab) => {
        const isActive = tab.dataset.filter === filter;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-pressed", String(isActive));
    });
    render();
}

function initialize() {
    elements.today.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date());
    elements.taskForm.addEventListener("submit", handleSubmit);
    elements.title.addEventListener("input", () => elements.title.setCustomValidity(""));
    elements.cancelEdit.addEventListener("click", resetForm);
    elements.search.addEventListener("input", render);
    elements.sort.addEventListener("change", render);
    elements.filterTabs.forEach((tab) => tab.addEventListener("click", () => setFilter(tab.dataset.filter)));
    elements.clearCompleted.addEventListener("click", clearCompleted);
    elements.pickTask.addEventListener("click", pickFocusTask);
    document.addEventListener("keydown", (event) => {
        if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
            event.preventDefault();
            elements.search.focus();
        }
        if (event.key === "Escape" && editingTaskId) resetForm();
    });
    render();
}

initialize();
