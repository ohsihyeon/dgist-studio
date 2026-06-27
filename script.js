const days = ["월", "화", "수", "목", "금"];
const categoryColors = {
  기초필수: "#1f6fff",
  심화필수: "#7a5cff",
};
const previewColors = ["#5b8cff", "#76d7b8", "#ffd56b", "#ff9a8a", "#b69cff", "#8bd3ff", "#f3a6c8"];
const calendarStart = 9 * 60;
const calendarEnd = 21 * 60;
const slotMinutes = 30;
const rowHeight = 30;
const storageKey = "timetable-chef-v3";
const shelfStorageKey = "timetable-chef-shelf-v1";
const activeShelfStorageKey = "timetable-chef-active-shelf-v1";
const layoutStorageKey = "timetable-chef-layout-original-v2";
const wizardLayoutStorageKey = "timetable-chef-wizard-layout-v1";

const state = {
  subjects: [],
  pendingIds: [],
  placedIds: [],
  shelf: [],
  activeShelfId: "",
  filter: "전체",
  expandedGroups: new Set(),
  wizardSelectedIds: new Set(),
  wizardResults: [],
  wizardSelectedResultIndex: 0,
};

const calendar = document.querySelector("#calendar");
const subjectPanel = document.querySelector(".subject-panel");
const subjectList = document.querySelector("#subjectList");
const pendingList = document.querySelector("#pendingList");
const panelResizer = document.querySelector("#panelResizer");
const subjectTemplate = document.querySelector("#subjectTemplate");
const searchInput = document.querySelector("#searchInput");
const courseEmptyState = document.querySelector("#courseEmptyState");
const pendingEmptyState = document.querySelector("#pendingEmptyState");
const pendingCount = document.querySelector("#pendingCount");
const creditCount = document.querySelector("#creditCount");
const dataInfo = document.querySelector("#dataInfo");
const filterRow = document.querySelector("#filterRow");
const toast = document.querySelector("#toast");
const enterWorkbenchBtn = document.querySelector("#enterWorkbenchBtn");
const enterWizardBtn = document.querySelector("#enterWizardBtn");
const lobbyBackBtn = document.querySelector("#lobbyBackBtn");
const wizardBackBtn = document.querySelector("#wizardBackBtn");
const wizardSearchInput = document.querySelector("#wizardSearchInput");
const wizardShell = document.querySelector(".wizard-shell");
const wizardResizer = document.querySelector("#wizardResizer");
const wizardSubjectList = document.querySelector("#wizardSubjectList");
const wizardSelectedCount = document.querySelector("#wizardSelectedCount");
const wizardResultCount = document.querySelector("#wizardResultCount");
const wizardGenerateBtn = document.querySelector("#wizardGenerateBtn");
const wizardClearBtn = document.querySelector("#wizardClearBtn");
const wizardResults = document.querySelector("#wizardResults");
const wizardEmptyState = document.querySelector("#wizardEmptyState");
const wizardResultModal = document.querySelector("#wizardResultModal");
const wizardResultModalTitle = document.querySelector("#wizardResultModalTitle");
const wizardResultModalMeta = document.querySelector("#wizardResultModalMeta");
const wizardResultModalBody = document.querySelector("#wizardResultModalBody");
const closeWizardResultBtn = document.querySelector("#closeWizardResultBtn");
const shelfBtn = document.querySelector("#shelfBtn");
const shelfModal = document.querySelector("#shelfModal");
const closeShelfBtn = document.querySelector("#closeShelfBtn");
const saveShelfBtn = document.querySelector("#saveShelfBtn");
const newTimetableBtn = document.querySelector("#newTimetableBtn");
const shelfNameInput = document.querySelector("#shelfNameInput");
const shelfList = document.querySelector("#shelfList");
const shelfEmptyState = document.querySelector("#shelfEmptyState");
const activeShelfLabel = document.querySelector("#activeShelfLabel");
const activeTimetableBadge = document.querySelector("#activeTimetableBadge");

function clean(value) {
  const text = String(value || "").trim();
  return text || "미정";
}

function stripCourseCode(name) {
  return clean(name)
    .replace(/\(([A-Z0-9]{1,5}\s*)?\d{2,4}[A-Za-z]?\)/g, "")
    .replace(/\([A-Z0-9]{1,6}\s*\d{1,4}[A-Za-z]?\)/g, "")
    .replace(/대[A-Z0-9]{1,6}\s*\d{1,4}[A-Za-z]?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripEnglishLectureLabel(name) {
  return clean(name)
    .replace(/\s*-\s*영어강의\s*$/g, "")
    .trim();
}

function isEnglishLectureName(name) {
  return /\s*-\s*영어강의\s*$/.test(clean(name));
}

function formatCredit(value) {
  const text = clean(value);
  const number = Number(text);
  if (!Number.isNaN(number) && Number.isInteger(number)) return String(number);
  return text;
}

function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function normalizeTime(time) {
  const [hours, minutes] = time.split(":");
  return `${String(Number(hours)).padStart(2, "0")}:${minutes}`;
}

function isValidSession(session) {
  if (!days.includes(session.day)) return false;
  const start = toMinutes(session.start);
  const end = toMinutes(session.end);
  return start < end && start >= calendarStart && end <= calendarEnd;
}

function sessionsOverlap(a, b) {
  if (a.day !== b.day) return false;
  return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
}

function parseSessions(rawSchedule) {
  const raw = clean(rawSchedule);
  if (raw === "미정") return [];

  const sessions = [];
  const pattern = /([월화수목금토일])\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})(?:\(([^)]*)\))?/g;
  for (const match of raw.matchAll(pattern)) {
    sessions.push({
      day: match[1],
      start: normalizeTime(match[2]),
      end: normalizeTime(match[3]),
      room: clean(match[4]),
    });
  }
  return sessions;
}

function formatScheduleTimeOnly(subject) {
  if (!subject.sessions.length) return "시간 미정";
  return subject.sessions.map((session) => `${session.day}${session.start}-${session.end}`).join(", ");
}

function splitCellList(value) {
  const text = clean(value);
  if (text === "미정") return [];
  return text
    .split(/\s*[/,]\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildRawSchedule(row) {
  const existing = clean(row["요일교시강의실"]);
  if (existing !== "미정") return existing;

  const dayText = clean(row["요일"]);
  const timeText = clean(row["시간"]);
  const roomText = clean(row["교실"]);
  if (dayText === "미정" || timeText === "미정") return "미정";

  const dayParts = splitCellList(dayText);
  const timeParts = splitCellList(timeText);
  const roomParts = splitCellList(roomText);

  if (!dayParts.length || !timeParts.length) return "미정";

  return dayParts
    .map((day, index) => {
      const time = timeParts[index] || timeParts[0];
      const room = roomParts[index] || roomParts[0] || "미정";
      const normalizedTime = time.replace(new RegExp(`^${day}\\s*`), "");
      return `${day}${normalizedTime}${room === "미정" ? "" : `(${room})`}`;
    })
    .join(", ");
}

function formatSessions(subject) {
  if (!subject.sessions.length) return "시간 미정";
  return subject.sessions.map((session) => `${session.day}${session.start}-${session.end}`).join(" / ");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((item) => item.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((item) => item.trim() !== "")) rows.push(row);

  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.map((cells) =>
    headers.reduce((record, header, index) => {
      record[header] = cells[index] || "";
      return record;
    }, {}),
  );
}

function createSubject(row, index) {
  const rawSchedule = buildRawSchedule(row);
  const sessions = parseSessions(rawSchedule);
  const name = stripCourseCode(row["교과목명"]);
  const groupName = stripEnglishLectureLabel(name);
  const source = clean(row["원본파일"]);
  const fallbackId = `${index + 1}-${name}`;

  return {
    id: `${source === "미정" ? fallbackId : source}-${index + 1}`,
    name,
    category: clean(row["이수구분"]),
    area: clean(row["교과영역"]),
    credits: formatCredit(row["학점"]),
    dayText: clean(row["요일"]),
    timeText: clean(row["시간"]),
    room: clean(row["교실"]),
    professor: clean(row["담당교수"]),
    rawSchedule,
    source,
    review: clean(row["검토필요"]),
    sessions,
    originalIndex: index,
    groupName,
    isEnglishLecture: isEnglishLectureName(name),
    sectionNumber: 0,
    sectionLabel: "",
    displayName: name,
    groupIndex: index,
  };
}

function applySectionLabels(subjects) {
  const counts = new Map();
  const firstIndex = new Map();
  const seen = new Map();

  subjects.forEach((subject, index) => {
    const key = subject.groupName;
    counts.set(key, (counts.get(key) || 0) + 1);
    if (!firstIndex.has(key)) firstIndex.set(key, index);
  });

  subjects.forEach((subject) => {
    const key = subject.groupName;
    const next = (seen.get(key) || 0) + 1;
    seen.set(key, next);
    subject.groupIndex = firstIndex.get(key) ?? subject.originalIndex;

    if ((counts.get(key) || 0) > 1) {
      subject.sectionNumber = next;
      subject.sectionLabel = `${next}분반`;
      subject.displayName = `${subject.groupName} ${subject.sectionLabel}${subject.isEnglishLecture ? " 영어강의" : ""}`;
    }
  });

  return subjects.sort((a, b) => {
    if (a.groupIndex !== b.groupIndex) return a.groupIndex - b.groupIndex;
    if (a.groupName !== b.groupName) return a.groupName.localeCompare(b.groupName, "ko");
    return a.sectionNumber - b.sectionNumber || a.originalIndex - b.originalIndex;
  });
}

async function loadCourses() {
  try {
    const response = await fetch("courses.csv", { cache: "no-store" });
    if (!response.ok) throw new Error("courses.csv를 불러오지 못했습니다.");
    const csv = await response.text();
    state.subjects = applySectionLabels(parseCsv(csv).map(createSubject));
    dataInfo.textContent = `과목 ${state.subjects.length}개`;
    loadSavedState();
    loadShelf();
    renderFilterChips();
    render();
  } catch (error) {
    dataInfo.textContent = "과목 0개";
    showToast("courses.csv를 불러오지 못했습니다. 로컬 미리보기 주소로 열어주세요.", "error");
    render();
  }
}

function showToast(message, type = "normal") {
  toast.textContent = message;
  toast.className = `toast show${type === "error" ? " error" : ""}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.className = "toast";
  }, 2400);
}

function loadSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!saved) return;
    const ids = new Set(state.subjects.map((subject) => subject.id));
    state.pendingIds = Array.isArray(saved.pendingIds) ? saved.pendingIds.filter((id) => ids.has(id)) : [];
    state.placedIds = Array.isArray(saved.placedIds) ? saved.placedIds.filter((id) => ids.has(id)) : [];
    state.activeShelfId = localStorage.getItem(activeShelfStorageKey) || "";
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function saveState() {
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      pendingIds: state.pendingIds,
      placedIds: state.placedIds,
    }),
  );
}

function normalizeSavedIds(ids) {
  const validIds = new Set(state.subjects.map((subject) => subject.id));
  return Array.isArray(ids) ? ids.filter((id) => validIds.has(id)) : [];
}

function loadShelf() {
  try {
    const saved = JSON.parse(localStorage.getItem(shelfStorageKey) || "[]");
    state.shelf = Array.isArray(saved)
      ? saved
          .map((item) => ({
            id: String(item.id || ""),
            name: String(item.name || "").trim() || "시간표",
            pendingIds: normalizeSavedIds(item.pendingIds),
            placedIds: normalizeSavedIds(item.placedIds),
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
          }))
          .filter((item) => item.id)
      : [];
  } catch {
    state.shelf = [];
    localStorage.removeItem(shelfStorageKey);
  }

  if (state.activeShelfId && !state.shelf.some((item) => item.id === state.activeShelfId)) {
    state.activeShelfId = "";
    localStorage.removeItem(activeShelfStorageKey);
  }
}

function saveShelf() {
  localStorage.setItem(shelfStorageKey, JSON.stringify(state.shelf));
  if (state.activeShelfId) localStorage.setItem(activeShelfStorageKey, state.activeShelfId);
  else localStorage.removeItem(activeShelfStorageKey);
}

function getActiveShelfItem() {
  return state.shelf.find((item) => item.id === state.activeShelfId);
}

function getNextShelfName() {
  const used = new Set(state.shelf.map((item) => item.name));
  let index = state.shelf.length + 1;
  let name = `시간표 ${index}`;
  while (used.has(name)) {
    index += 1;
    name = `시간표 ${index}`;
  }
  return name;
}

function getCurrentSnapshot() {
  return {
    pendingIds: [...state.pendingIds],
    placedIds: [...state.placedIds],
  };
}

function formatSavedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "저장일 미정";
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setPendingListHeight(height) {
  const panelHeight = subjectPanel.getBoundingClientRect().height;
  const maxHeight = Math.max(140, panelHeight - 320);
  const nextHeight = clamp(Math.round(height), 96, maxHeight);
  subjectPanel.style.setProperty("--pending-list-height", `${nextHeight}px`);
  return nextHeight;
}

function loadPanelLayout() {
  const savedHeight = Number(localStorage.getItem(layoutStorageKey));
  if (Number.isFinite(savedHeight) && savedHeight > 0) setPendingListHeight(savedHeight);
}

function savePanelLayout(height) {
  localStorage.setItem(layoutStorageKey, String(height));
}

function getWizardWidthBounds() {
  const shellWidth = wizardShell.getBoundingClientRect().width;
  const min = 340;
  const max = Math.max(min, shellWidth - 560);
  return { min, max };
}

function setWizardPickerWidth(width) {
  const { min, max } = getWizardWidthBounds();
  const nextWidth = clamp(Math.round(width), min, max);
  wizardShell.style.setProperty("--wizard-picker-width", `${nextWidth}px`);
  return nextWidth;
}

function loadWizardLayout() {
  const savedWidth = Number(localStorage.getItem(wizardLayoutStorageKey));
  if (Number.isFinite(savedWidth) && savedWidth > 0) setWizardPickerWidth(savedWidth);
}

function saveWizardLayout(width) {
  localStorage.setItem(wizardLayoutStorageKey, String(width));
}

function setupPanelResizer() {
  if (!panelResizer) return;

  let startY = 0;
  let startHeight = 0;
  let resizing = false;

  function startResize(clientY) {
    resizing = true;
    startY = clientY;
    startHeight = pendingList.getBoundingClientRect().height;
    subjectPanel.classList.add("resizing");
  }

  function moveResize(clientY) {
    if (!resizing) return;
    const nextHeight = setPendingListHeight(startHeight - (clientY - startY));
    savePanelLayout(nextHeight);
  }

  function finishResize() {
    resizing = false;
    subjectPanel.classList.remove("resizing");
  }

  panelResizer.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    startResize(event.clientY);
    panelResizer.setPointerCapture(event.pointerId);
  });

  panelResizer.addEventListener("pointermove", (event) => {
    moveResize(event.clientY);
  });

  function stopResize(event) {
    if (!resizing) return;
    finishResize();
    if (panelResizer.hasPointerCapture(event.pointerId)) panelResizer.releasePointerCapture(event.pointerId);
  }

  panelResizer.addEventListener("pointerup", stopResize);
  panelResizer.addEventListener("pointercancel", stopResize);
  panelResizer.addEventListener("lostpointercapture", () => {
    finishResize();
  });
  document.addEventListener("pointerup", stopResize);
  document.addEventListener("pointercancel", stopResize);

  panelResizer.addEventListener("mousedown", (event) => {
    event.preventDefault();
    startResize(event.clientY);
  });
  document.addEventListener("mousemove", (event) => moveResize(event.clientY));
  document.addEventListener("mouseup", finishResize);
}

function setupWizardResizer() {
  if (!wizardResizer || !wizardShell) return;

  let startX = 0;
  let startWidth = 0;
  let resizing = false;

  function startResize(clientX) {
    resizing = true;
    startX = clientX;
    startWidth = document.querySelector(".wizard-picker").getBoundingClientRect().width;
    wizardShell.classList.add("resizing");
  }

  function moveResize(clientX) {
    if (!resizing) return;
    const nextWidth = setWizardPickerWidth(startWidth + (clientX - startX));
    saveWizardLayout(nextWidth);
  }

  function finishResize() {
    resizing = false;
    wizardShell.classList.remove("resizing");
  }

  wizardResizer.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    startResize(event.clientX);
    wizardResizer.setPointerCapture(event.pointerId);
  });

  wizardResizer.addEventListener("pointermove", (event) => {
    moveResize(event.clientX);
  });

  function stopResize(event) {
    if (!resizing) return;
    finishResize();
    if (wizardResizer.hasPointerCapture(event.pointerId)) wizardResizer.releasePointerCapture(event.pointerId);
  }

  wizardResizer.addEventListener("pointerup", stopResize);
  wizardResizer.addEventListener("pointercancel", stopResize);
  wizardResizer.addEventListener("lostpointercapture", finishResize);
  document.addEventListener("pointerup", stopResize);
  document.addEventListener("pointercancel", stopResize);
}

function getSubject(id) {
  return state.subjects.find((subject) => subject.id === id);
}

function buildCalendar() {
  days.forEach((day) => {
    const header = document.createElement("div");
    header.className = "day-header";
    header.textContent = day;
    calendar.append(header);
  });

  for (let minutes = calendarStart; minutes < calendarEnd; minutes += slotMinutes) {
    const time = document.createElement("div");
    time.className = "time-cell";
    time.textContent = minutes % 60 === 0 ? String(minutes / 60) : "";
    calendar.append(time);

    days.forEach((day) => {
      const cell = document.createElement("div");
      cell.className = `slot-cell${minutes % 60 === 30 ? " hour" : ""}`;
      cell.dataset.day = day;
      cell.dataset.minute = String(minutes);
      calendar.append(cell);
    });
  }
}

function renderFilterChips() {
  const categories = [...new Set(state.subjects.map((subject) => subject.category))].filter(Boolean);
  const sorted = categories.sort((a, b) => {
    if (a === "미정") return 1;
    if (b === "미정") return -1;
    return a.localeCompare(b, "ko");
  });

  filterRow.innerHTML = "";
  ["전체", ...sorted].forEach((category) => {
    const chip = document.createElement("button");
    chip.className = `chip${state.filter === category ? " active" : ""}`;
    chip.type = "button";
    chip.dataset.filter = category;
    chip.textContent = category;
    chip.addEventListener("click", () => {
      state.filter = category;
      renderFilterChips();
      renderSubjects();
    });
    filterRow.append(chip);
  });
}

function renderCard(subject, mode) {
  const card = subjectTemplate.content.firstElementChild.cloneNode(true);
  const button = card.querySelector(".add-button");
  const actionWrap = document.createElement("div");
  const tags = [subject.category, subject.area].filter((item) => item && item !== "미정");
  const isPending = mode === "pending";

  actionWrap.className = "card-actions";
  button.replaceWith(actionWrap);

  if (subject.review !== "미정") tags.push("검토필요");
  card.classList.toggle("pending-card", isPending);
  card.querySelector(".subject-title").textContent = isPending ? subject.name : subject.displayName;
  card.querySelector(".subject-tags").innerHTML = tags.map((tag) => `<span class="tag">${tag}</span>`).join("");
  card.querySelector(".subject-meta").textContent = isPending
    ? `${subject.professor} · ${subject.credits}학점 · ${subject.room}${subject.sectionLabel ? ` · ${subject.sectionLabel}` : ""}`
    : `${subject.professor} · ${subject.credits}학점 · ${subject.room}`;
  card.querySelector(".subject-time").textContent = formatScheduleTimeOnly(subject);

  if (isPending) {
    const placeButton = button;
    const removeButton = document.createElement("button");

    placeButton.className = "add-button place-icon";
    placeButton.type = "button";
    placeButton.textContent = "";
    placeButton.setAttribute("aria-label", "시간표에 배치");
    placeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      placePending(subject.id);
    });

    removeButton.className = "remove-pending-button remove-icon";
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", "배치 대기중에서 빼기");
    removeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      removePending(subject.id);
    });

    actionWrap.append(placeButton, removeButton);
    card.addEventListener("click", () => placePending(subject.id));
  } else {
    button.classList.add("plus-icon");
    button.textContent = "";
    button.setAttribute("aria-label", "배치 대기중으로 이동");
    button.addEventListener("click", () => moveToPending(subject.id));
    actionWrap.append(button);
  }

  return card;
}

function createListActionButton(subject) {
  const button = document.createElement("button");
  button.className = "add-button plus-icon";
  button.type = "button";
  button.setAttribute("aria-label", "배치 대기중으로 이동");
  button.addEventListener("click", () => moveToPending(subject.id));
  return button;
}

function renderSectionRow(subject) {
  const row = document.createElement("article");
  const main = document.createElement("div");
  const title = document.createElement("div");
  const meta = document.createElement("div");
  const time = document.createElement("div");

  row.className = "section-row";
  main.className = "section-main";
  title.className = "section-title";
  meta.className = "section-meta";
  time.className = "section-time";

  title.textContent = `${subject.sectionLabel}${subject.isEnglishLecture ? " · 영어강의" : ""}`;
  meta.textContent = `${subject.professor} · ${subject.credits}학점 · ${subject.room}`;
  time.textContent = formatScheduleTimeOnly(subject);

  main.append(title, meta, time);
  row.append(main, createListActionButton(subject));
  return row;
}

function renderSubjectGroup(group) {
  if (group.length === 1 && group[0].sectionNumber === 0) return renderCard(group[0], "list");

  const representative = group[0];
  const groupKey = representative.groupName;
  const isExpanded = state.expandedGroups.has(groupKey);
  const card = document.createElement("article");
  const main = document.createElement("div");
  const header = document.createElement("div");
  const title = document.createElement("div");
  const tags = document.createElement("div");
  const summary = document.createElement("div");
  const toggle = document.createElement("button");
  const sectionList = document.createElement("div");
  const areas = [...new Set(group.map((subject) => subject.area).filter((item) => item && item !== "미정"))];
  const categories = [...new Set(group.map((subject) => subject.category).filter((item) => item && item !== "미정"))];
  const professors = [...new Set(group.map((subject) => subject.professor).filter((item) => item && item !== "미정"))];

  card.className = `subject-card group-card${isExpanded ? " expanded" : ""}`;
  main.className = "subject-main";
  header.className = "group-header";
  title.className = "subject-title";
  tags.className = "subject-tags";
  summary.className = "subject-meta";
  toggle.className = "section-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", String(isExpanded));
  toggle.textContent = isExpanded ? "접기" : `${group.length}개 분반`;
  sectionList.className = "section-list";

  title.textContent = representative.groupName;
  tags.innerHTML = [...categories, ...areas].slice(0, 3).map((tag) => `<span class="tag">${tag}</span>`).join("");
  summary.textContent = `${group.length}개 분반 · ${professors.slice(0, 2).join(", ")}${professors.length > 2 ? " 외" : ""}`;
  toggle.addEventListener("click", () => {
    if (state.expandedGroups.has(groupKey)) state.expandedGroups.delete(groupKey);
    else state.expandedGroups.add(groupKey);
    renderSubjects();
  });

  header.append(title, toggle);
  main.append(header, tags, summary);
  card.append(main);

  if (isExpanded) {
    group.forEach((subject) => sectionList.append(renderSectionRow(subject)));
    card.append(sectionList);
  }

  return card;
}

function groupSubjects(subjects) {
  const groups = [];
  let current = null;

  subjects.forEach((subject) => {
    if (!current || current[0].groupName !== subject.groupName) {
      current = [];
      groups.push(current);
    }
    current.push(subject);
  });

  return groups;
}

function groupAllSubjects() {
  return groupSubjects(state.subjects);
}

function subjectCanBeScheduled(subject) {
  return subject.sessions.length > 0 && subject.sessions.every(isValidSession);
}

function subjectsConflict(a, b) {
  return a.sessions.some((session) => b.sessions.some((otherSession) => sessionsOverlap(session, otherSession)));
}

function getWizardSelectedGroups() {
  const groupNames = [];
  groupAllSubjects().forEach((group) => {
    if (group.some((subject) => state.wizardSelectedIds.has(subject.id))) groupNames.push(group[0].groupName);
  });
  return groupNames;
}

function getWizardGroupOptions(groupName) {
  return state.subjects.filter(
    (subject) => subject.groupName === groupName && state.wizardSelectedIds.has(subject.id) && subjectCanBeScheduled(subject),
  );
}

function toggleWizardSubject(subject) {
  if (state.wizardSelectedIds.has(subject.id)) state.wizardSelectedIds.delete(subject.id);
  else state.wizardSelectedIds.add(subject.id);
  state.wizardResults = [];
  state.wizardSelectedResultIndex = 0;
  renderWizard();
}

function selectAllWizardGroup(group) {
  const selectable = group.filter(subjectCanBeScheduled);
  if (!selectable.length) return;
  const allSelected = selectable.every((subject) => state.wizardSelectedIds.has(subject.id));
  selectable.forEach((subject) => {
    if (allSelected) state.wizardSelectedIds.delete(subject.id);
    else state.wizardSelectedIds.add(subject.id);
  });
  state.wizardResults = [];
  state.wizardSelectedResultIndex = 0;
  renderWizard();
}

function isSectionedSubject(subject) {
  return subject.sectionNumber > 0;
}

function renderSubjects() {
  const query = searchInput.value.trim().toLowerCase();
  const hiddenIds = new Set([...state.pendingIds, ...state.placedIds]);
  const filtered = state.subjects.filter((subject) => {
    const matchesFilter = state.filter === "전체" || subject.category === state.filter;
    const text = `${subject.name} ${subject.groupName} ${subject.sectionLabel} ${subject.professor} ${subject.area} ${subject.category} ${subject.rawSchedule}`.toLowerCase();
    return matchesFilter && text.includes(query) && !hiddenIds.has(subject.id);
  });

  subjectList.innerHTML = "";
  groupSubjects(filtered).forEach((group) => {
    if (group.length > 1 || isSectionedSubject(group[0])) {
      subjectList.append(renderSubjectGroup(group));
    } else {
      subjectList.append(renderCard(group[0], "list"));
    }
  });

  courseEmptyState.style.display = filtered.length === 0 ? "grid" : "none";
}

function renderWizardSubjects() {
  const query = wizardSearchInput.value.trim().toLowerCase();
  wizardSubjectList.replaceChildren();

  groupAllSubjects()
    .filter((group) => {
      const text = group
        .map((subject) => `${subject.name} ${subject.groupName} ${subject.professor} ${subject.area} ${subject.category}`)
        .join(" ")
        .toLowerCase();
      return text.includes(query);
    })
    .forEach((group) => {
      const representative = group[0];
      const categories = [...new Set(group.map((subject) => subject.category).filter((item) => item && item !== "미정"))];
      const areas = [...new Set(group.map((subject) => subject.area).filter((item) => item && item !== "미정"))];
      const professors = [...new Set(group.map((subject) => subject.professor).filter((item) => item && item !== "미정"))];
      const schedulableSubjects = group.filter(subjectCanBeScheduled);
      const schedulableCount = schedulableSubjects.length;
      const singleDirectSubject = group.length === 1 && schedulableSubjects.length === 1 ? schedulableSubjects[0] : null;
      const selectedCount = group.filter((subject) => state.wizardSelectedIds.has(subject.id)).length;
      const selected = selectedCount > 0;
      const isExpanded = state.expandedGroups.has(`wizard:${representative.groupName}`);
      const card = document.createElement("article");
      const main = document.createElement("div");
      const header = document.createElement("div");
      const title = document.createElement("div");
      const tags = document.createElement("div");
      const meta = document.createElement("div");
      const toggle = document.createElement("button");
      const selectButton = document.createElement("button");
      const sectionList = document.createElement("div");

      card.className = `wizard-subject-card${selected ? " selected" : ""}`;
      main.className = "wizard-subject-main";
      header.className = "wizard-subject-header";
      title.className = "wizard-subject-title";
      tags.className = "subject-tags";
      meta.className = "wizard-subject-meta";
      toggle.className = "section-toggle wizard-section-toggle";
      selectButton.className = "wizard-check";
      sectionList.className = "wizard-section-list";

      title.textContent = representative.groupName;
      tags.innerHTML = [...categories, ...areas].slice(0, 3).map((tag) => `<span class="tag">${tag}</span>`).join("");
      meta.textContent = singleDirectSubject
        ? `${singleDirectSubject.professor} · ${singleDirectSubject.credits}학점 · ${formatSessions(singleDirectSubject)}`
        : `${group.length}개 분반 · 배치 가능 ${schedulableCount}개 · 선택 ${selectedCount}개 · ${professors.slice(0, 2).join(", ")}${professors.length > 2 ? " 외" : ""}`;
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", String(isExpanded));
      toggle.textContent = isExpanded ? "접기" : `${group.length}개 분반`;
      selectButton.type = "button";
      selectButton.setAttribute(
        "aria-label",
        singleDirectSubject ? `${representative.groupName} 선택` : `${representative.groupName} 배치 가능한 분반 전체 선택`,
      );
      selectButton.textContent = "✓";

      toggle.addEventListener("click", () => {
        const key = `wizard:${representative.groupName}`;
        if (state.expandedGroups.has(key)) state.expandedGroups.delete(key);
        else state.expandedGroups.add(key);
        renderWizard();
      });

      selectButton.addEventListener("click", (event) => {
        event.stopPropagation();
        if (singleDirectSubject) toggleWizardSubject(singleDirectSubject);
        else selectAllWizardGroup(group);
      });

      header.append(title);
      if (!singleDirectSubject) header.append(toggle);
      main.append(header, tags, meta);
      card.append(main, selectButton);

      if (singleDirectSubject) {
        card.classList.add("direct-select");
        card.addEventListener("click", () => toggleWizardSubject(singleDirectSubject));
      }

      if (!singleDirectSubject && isExpanded) {
        group.forEach((subject) => {
          const row = document.createElement("button");
          const rowMain = document.createElement("span");
          const rowTitle = document.createElement("strong");
          const rowMeta = document.createElement("span");
          const rowCheck = document.createElement("i");
          const canSchedule = subjectCanBeScheduled(subject);
          const rowSelected = state.wizardSelectedIds.has(subject.id);

          row.className = `wizard-section-row${rowSelected ? " selected" : ""}`;
          row.type = "button";
          row.disabled = !canSchedule;
          rowMain.className = "wizard-section-main";
          rowCheck.className = "wizard-section-check";
          rowTitle.textContent = subject.sectionLabel || subject.displayName;
          rowMeta.textContent = `${subject.professor} · ${subject.credits}학점 · ${formatSessions(subject)}`;
          rowCheck.textContent = "✓";

          row.addEventListener("click", () => toggleWizardSubject(subject));
          rowMain.append(rowTitle, rowMeta);
          row.append(rowMain, rowCheck);
          sectionList.append(row);
        });
        card.append(sectionList);
      }

      wizardSubjectList.append(card);
    });
}

function findWizardCombinations() {
  const selectedGroups = getWizardSelectedGroups();
  const orderedGroups = selectedGroups
    .map((groupName, index) => ({
      groupName,
      index,
      options: getWizardGroupOptions(groupName),
    }))
    .sort((a, b) => a.options.length - b.options.length);
  const results = [];
  const maxResults = 30;

  if (!orderedGroups.length || orderedGroups.some((group) => group.options.length === 0)) return [];

  function search(groupIndex, chosen) {
    if (results.length >= maxResults) return;
    if (groupIndex === orderedGroups.length) {
      results.push(
        [...chosen].sort((a, b) => selectedGroups.indexOf(a.groupName) - selectedGroups.indexOf(b.groupName)),
      );
      return;
    }

    orderedGroups[groupIndex].options.forEach((subject) => {
      if (chosen.some((selected) => subjectsConflict(subject, selected))) return;
      chosen.push(subject);
      search(groupIndex + 1, chosen);
      chosen.pop();
    });
  }

  search(0, []);
  return results;
}

function createWizardMiniTimetable(result, compact = false) {
  const preview = document.createElement("div");
  const dayRow = document.createElement("div");
  const grid = document.createElement("div");

  preview.className = `wizard-mini-timetable${compact ? " compact-preview" : ""}`;
  dayRow.className = "wizard-mini-days";
  grid.className = "wizard-mini-grid";

  days.forEach((day) => {
    const dayCell = document.createElement("span");
    dayCell.textContent = day;
    dayRow.append(dayCell);
  });

  result.forEach((subject, subjectIndex) => {
    subject.sessions.forEach((session) => {
      const dayIndex = days.indexOf(session.day);
      const start = toMinutes(session.start);
      const end = toMinutes(session.end);
      if (dayIndex < 0 || start < calendarStart || end > calendarEnd) return;

      const block = document.createElement("div");
      const top = ((start - calendarStart) / (calendarEnd - calendarStart)) * 100;
      const height = ((end - start) / (calendarEnd - calendarStart)) * 100;
      const dayWidth = 100 / days.length;
      const compactInset = compact ? 2 : 0;

      block.className = "wizard-mini-block";
      block.style.left = `${dayIndex * dayWidth + compactInset}%`;
      block.style.top = `${top}%`;
      block.style.width = `${dayWidth - compactInset * 2}%`;
      block.style.height = `${Math.max(height, 7)}%`;
      block.style.background = compact
        ? previewColors[subjectIndex % previewColors.length]
        : categoryColors[subject.category] || categoryColors["기초필수"];
      block.style.setProperty("--mini-offset", `${subjectIndex % 3}px`);
      block.title = `${subject.displayName} · ${session.day}${session.start}-${session.end}`;
      block.textContent = compact ? "" : subject.groupName;
      grid.append(block);
    });
  });

  preview.append(dayRow, grid);
  return preview;
}

function renderWizardResults() {
  wizardResults.replaceChildren();

  if (!state.wizardResults.length) {
    wizardEmptyState.style.display = "grid";
    wizardResultCount.textContent = state.wizardSelectedIds.size ? "가능한 조합 없음" : "아직 만든 조합 없음";
    return;
  }

  wizardEmptyState.style.display = "none";
  wizardResultCount.textContent = `${state.wizardResults.length}개 조합 발견`;
  state.wizardSelectedResultIndex = clamp(state.wizardSelectedResultIndex, 0, state.wizardResults.length - 1);

  const previewStrip = document.createElement("div");

  previewStrip.className = "wizard-preview-strip";

  state.wizardResults.forEach((result, index) => {
    const previewCard = document.createElement("button");
    const badge = document.createElement("span");

    previewCard.className = `wizard-preview-card${index === state.wizardSelectedResultIndex ? " selected" : ""}`;
    previewCard.type = "button";
    previewCard.setAttribute("aria-label", `조합 ${index + 1} 확인`);
    badge.className = "wizard-preview-badge";
    badge.textContent = String(index + 1);
    previewCard.append(badge, createWizardMiniTimetable(result, true));
    previewCard.addEventListener("click", () => {
      state.wizardSelectedResultIndex = index;
      renderWizardResults();
      openWizardResult(index);
    });
    previewStrip.append(previewCard);
  });

  wizardResults.append(previewStrip);
}

function renderWizardResultModal(index) {
  const result = state.wizardResults[index];
  if (!result) return;

  const head = document.createElement("div");
  const applyButton = document.createElement("button");
  const list = document.createElement("div");
  const miniTimetable = createWizardMiniTimetable(result);
  const totalCredits = result.reduce((sum, subject) => sum + (Number(subject.credits) || 0), 0);

  wizardResultModalBody.replaceChildren();
  wizardResultModalTitle.textContent = `조합 ${index + 1}`;
  wizardResultModalMeta.textContent = `${result.length}과목 · ${totalCredits}학점`;
  head.className = "wizard-result-modal-actions";
  applyButton.className = "wizard-apply-button";
  list.className = "wizard-result-list";
  applyButton.type = "button";
  applyButton.textContent = "시간표에 적용";
  applyButton.addEventListener("click", () => applyWizardResult(index));

  result.forEach((subject) => {
    const row = document.createElement("div");
    const name = document.createElement("strong");
    const time = document.createElement("span");

    row.className = "wizard-result-row";
    name.textContent = subject.displayName;
    time.textContent = formatSessions(subject);
    row.append(name, time);
    list.append(row);
  });

  head.append(applyButton);
  wizardResultModalBody.append(head, miniTimetable, list);
}

function openWizardResult(index) {
  state.wizardSelectedResultIndex = index;
  renderWizardResultModal(index);
  wizardResultModal.classList.add("open");
  wizardResultModal.setAttribute("aria-hidden", "false");
}

function closeWizardResult() {
  wizardResultModal.classList.remove("open");
  wizardResultModal.setAttribute("aria-hidden", "true");
}

function renderWizard() {
  wizardSelectedCount.textContent = `선택 ${getWizardSelectedGroups().length}개`;
  renderWizardSubjects();
  renderWizardResults();
}

function renderPending() {
  const pendingSubjects = state.pendingIds.map(getSubject).filter(Boolean);
  pendingList.replaceChildren();

  if (pendingSubjects.length === 0) {
    pendingEmptyState.style.display = "grid";
    pendingList.append(pendingEmptyState);
  } else {
    pendingEmptyState.style.display = "none";
    pendingSubjects.forEach((subject) => {
      pendingList.append(renderCard(subject, "pending"));
    });
  }

  pendingCount.textContent = String(pendingSubjects.length);
}

function renderBlocks() {
  calendar.querySelectorAll(".course-block").forEach((block) => block.remove());

  state.placedIds
    .map(getSubject)
    .filter(Boolean)
    .forEach((subject) => {
      subject.sessions.forEach((session) => {
        const dayIndex = days.indexOf(session.day);
        const start = toMinutes(session.start);
        const end = toMinutes(session.end);
        const top = 40 + ((start - calendarStart) / slotMinutes) * rowHeight;
        const height = ((end - start) / slotMinutes) * rowHeight;
        const width = (calendar.clientWidth - 56) / 5;

        const block = document.createElement("div");
        block.className = "course-block";
        block.style.top = `${top + 4}px`;
        block.style.left = `${56 + dayIndex * width}px`;
        block.style.width = `${width}px`;
        block.style.height = `${Math.max(height - 8, 44)}px`;
        block.style.background = categoryColors[subject.category] || categoryColors["기초필수"];
        const sectionText = subject.sectionLabel ? ` · ${subject.sectionLabel}` : "";
        block.innerHTML = `
          <strong>${subject.name}</strong>
          <span>${subject.professor} · ${subject.credits}학점${sectionText}</span>
          <span>${session.day}${session.start}-${session.end} · ${session.room}</span>
          <button type="button" aria-label="${subject.displayName} 배치 대기중으로 이동">×</button>
        `;
        block.querySelector("button").addEventListener("click", () => removePlaced(subject.id));
        calendar.append(block);
      });
    });
}

function renderSummary() {
  const total = state.placedIds
    .map(getSubject)
    .filter(Boolean)
    .reduce((sum, subject) => sum + (Number(subject.credits) || 0), 0);

  creditCount.textContent = `${total}/21`;
  creditCount.classList.toggle("low", total >= 0 && total <= 9);
  creditCount.classList.toggle("good", total >= 10 && total <= 21);
  creditCount.classList.toggle("over", total > 21);
}

function renderShelf() {
  const active = getActiveShelfItem();
  activeShelfLabel.textContent = active ? `${active.name} 작업 중` : "현재 작업 중인 시간표 없음";
  activeTimetableBadge.textContent = active ? active.name : "새 시간표";
  shelfNameInput.value = active ? active.name : "";
  shelfList.innerHTML = "";

  state.shelf.forEach((item) => {
    const card = document.createElement("article");
    const main = document.createElement("div");
    const title = document.createElement("div");
    const meta = document.createElement("div");
    const actions = document.createElement("div");
    const editButton = document.createElement("button");
    const deleteButton = document.createElement("button");
    const placedCount = item.placedIds.length;
    const pendingCountValue = item.pendingIds.length;

    card.className = `shelf-item${item.id === state.activeShelfId ? " active" : ""}`;
    main.className = "shelf-item-main";
    title.className = "shelf-item-title";
    meta.className = "shelf-item-meta";
    actions.className = "shelf-item-actions";
    editButton.className = "shelf-action";
    deleteButton.className = "shelf-action delete";

    title.textContent = item.name;
    meta.textContent = `시간표 ${placedCount}개 · 대기 ${pendingCountValue}개 · ${formatSavedDate(item.updatedAt)}`;
    editButton.type = "button";
    editButton.textContent = item.id === state.activeShelfId ? "작업 중" : "수정";
    deleteButton.type = "button";
    deleteButton.textContent = "삭제";

    editButton.addEventListener("click", () => editShelfItem(item.id));
    deleteButton.addEventListener("click", () => deleteShelfItem(item.id));

    main.append(title, meta);
    actions.append(editButton, deleteButton);
    card.append(main, actions);
    shelfList.append(card);
  });

  shelfEmptyState.style.display = state.shelf.length === 0 ? "grid" : "none";
}

function render() {
  renderSubjects();
  renderPending();
  renderBlocks();
  renderSummary();
  renderShelf();
  renderWizard();
}

function generateWizardResults() {
  if (state.wizardSelectedIds.size === 0) {
    showToast("마법사에서 분반을 먼저 골라주세요.", "error");
    return;
  }

  state.wizardResults = findWizardCombinations();
  state.wizardSelectedResultIndex = 0;
  renderWizard();

  if (state.wizardResults.length) {
    showToast(`가능한 시간표 ${state.wizardResults.length}개를 찾았습니다.`);
  } else {
    showToast("선택한 과목으로는 겹치지 않는 시간표를 찾지 못했습니다.", "error");
  }
}

function clearWizardSelection() {
  state.wizardSelectedIds.clear();
  state.wizardResults = [];
  state.wizardSelectedResultIndex = 0;
  renderWizard();
}

function applyWizardResult(index) {
  const result = state.wizardResults[index];
  if (!result) return;

  state.activeShelfId = "";
  state.pendingIds = [];
  state.placedIds = result.map((subject) => subject.id);
  saveState();
  saveShelf();
  render();
  enterWorkbench();
  showToast(`마법사가 고른 ${result.length}과목을 시간표에 적용했습니다.`);
}

function moveToPending(id) {
  if (state.pendingIds.includes(id) || state.placedIds.includes(id)) return;
  const subject = getSubject(id);
  if (!subject) return;

  state.pendingIds.push(id);
  render();
  showToast(`${subject.displayName}을 배치 대기중으로 옮겼습니다.`);
}

function removePending(id) {
  const subject = getSubject(id);
  state.pendingIds = state.pendingIds.filter((pendingId) => pendingId !== id);
  render();
  showToast(`${subject?.displayName || "과목"}을 배치 대기중에서 뺐습니다.`);
}

function findConflict(subject) {
  for (const session of subject.sessions) {
    for (const placedId of state.placedIds) {
      const placed = getSubject(placedId);
      if (!placed) continue;
      const conflict = placed.sessions.find((placedSession) => sessionsOverlap(session, placedSession));
      if (conflict) return placed;
    }
  }
  return null;
}

function placePending(id) {
  const subject = getSubject(id);
  if (!subject) return;

  if (!subject.sessions.length) {
    showToast(`${subject.displayName}은 시간이 미정이라 배치할 수 없습니다.`, "error");
    return;
  }

  if (!subject.sessions.every(isValidSession)) {
    showToast(`${subject.displayName}은 09:00-21:00 시간표 범위를 벗어납니다.`, "error");
    return;
  }

  const conflict = findConflict(subject);
  if (conflict) {
    showToast(`${subject.displayName}은 ${conflict.displayName}과 시간이 겹쳐 추가할 수 없습니다.`, "error");
    return;
  }

  state.pendingIds = state.pendingIds.filter((pendingId) => pendingId !== id);
  state.placedIds.push(id);
  render();
  showToast(`${subject.displayName}을 시간표에 표시했습니다.`);
}

function removePlaced(id) {
  const subject = getSubject(id);
  state.placedIds = state.placedIds.filter((placedId) => placedId !== id);
  if (subject && !state.pendingIds.includes(id)) {
    state.pendingIds.push(id);
  }
  render();
  showToast(`${subject?.displayName || "과목"}을 배치 대기중으로 돌렸습니다.`);
}

function openShelf() {
  renderShelf();
  shelfModal.classList.add("open");
  shelfModal.setAttribute("aria-hidden", "false");
  shelfNameInput.focus();
}

function closeShelf() {
  shelfModal.classList.remove("open");
  shelfModal.setAttribute("aria-hidden", "true");
}

function saveCurrentToShelf() {
  const now = new Date().toISOString();
  const active = getActiveShelfItem();
  const snapshot = getCurrentSnapshot();
  const typedName = shelfNameInput.value.trim();

  if (active) {
    active.name = typedName || active.name;
    active.pendingIds = snapshot.pendingIds;
    active.placedIds = snapshot.placedIds;
    active.updatedAt = now;
  } else {
    const item = {
      id: `shelf-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: typedName || getNextShelfName(),
      ...snapshot,
      createdAt: now,
      updatedAt: now,
    };
    state.shelf.unshift(item);
    state.activeShelfId = item.id;
  }

  saveShelf();
  saveState();
  render();
  showToast("시간표 보관함에 저장했습니다.");
}

function createNewTimetable() {
  state.activeShelfId = "";
  state.pendingIds = [];
  state.placedIds = [];
  saveState();
  saveShelf();
  render();
  showToast("새 시간표를 시작했습니다.");
}

function editShelfItem(id) {
  const item = state.shelf.find((savedItem) => savedItem.id === id);
  if (!item) return;
  state.activeShelfId = item.id;
  state.pendingIds = [...item.pendingIds];
  state.placedIds = [...item.placedIds];
  saveState();
  saveShelf();
  render();
  closeShelf();
  showToast(`${item.name}을 수정합니다.`);
}

function deleteShelfItem(id) {
  const item = state.shelf.find((savedItem) => savedItem.id === id);
  state.shelf = state.shelf.filter((savedItem) => savedItem.id !== id);
  if (state.activeShelfId === id) {
    state.activeShelfId = "";
    state.pendingIds = [];
    state.placedIds = [];
  }
  saveState();
  saveShelf();
  render();
  showToast(`${item?.name || "시간표"}를 삭제했습니다.`);
}

function enterWorkbench() {
  document.body.classList.remove("wizard-active");
  document.body.classList.remove("lobby-active");
  document.title = "시간표 작업대";
  renderBlocks();
}

function enterWizard() {
  closeShelf();
  closeWizardResult();
  document.body.classList.remove("lobby-active");
  document.body.classList.add("wizard-active");
  document.title = "시간표 마법사";
  loadWizardLayout();
  renderWizard();
  wizardSearchInput.focus();
}

function returnToLobby() {
  closeShelf();
  closeWizardResult();
  document.body.classList.remove("wizard-active");
  document.body.classList.add("lobby-active");
  document.title = "DGIST STUDIO";
}

searchInput.addEventListener("input", renderSubjects);
wizardSearchInput.addEventListener("input", renderWizardSubjects);

document.querySelector("#clearBtn").addEventListener("click", () => {
  state.pendingIds = [];
  state.placedIds = [];
  render();
  showToast("시간표를 비웠습니다.");
});

shelfBtn.addEventListener("click", openShelf);
closeShelfBtn.addEventListener("click", closeShelf);
closeWizardResultBtn.addEventListener("click", closeWizardResult);
saveShelfBtn.addEventListener("click", saveCurrentToShelf);
newTimetableBtn.addEventListener("click", createNewTimetable);
enterWorkbenchBtn.addEventListener("click", enterWorkbench);
enterWizardBtn.addEventListener("click", enterWizard);
lobbyBackBtn.addEventListener("click", returnToLobby);
wizardBackBtn.addEventListener("click", returnToLobby);
wizardGenerateBtn.addEventListener("click", generateWizardResults);
wizardClearBtn.addEventListener("click", clearWizardSelection);

shelfModal.addEventListener("click", (event) => {
  if (event.target === shelfModal) closeShelf();
});

wizardResultModal.addEventListener("click", (event) => {
  if (event.target === wizardResultModal) closeWizardResult();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && shelfModal.classList.contains("open")) closeShelf();
  if (event.key === "Escape" && wizardResultModal.classList.contains("open")) closeWizardResult();
});

window.addEventListener("resize", () => {
  const currentHeight = pendingList.getBoundingClientRect().height;
  setPendingListHeight(currentHeight);
  if (document.body.classList.contains("wizard-active")) {
    const currentWidth = document.querySelector(".wizard-picker").getBoundingClientRect().width;
    setWizardPickerWidth(currentWidth);
  }
  renderBlocks();
});

setupPanelResizer();
setupWizardResizer();
loadPanelLayout();
buildCalendar();
loadCourses();
