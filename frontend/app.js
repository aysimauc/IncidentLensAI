// ============================================================
// INCIDENTLENS AI
// FRONTEND APPLICATION
// ============================================================

const API_URL = "http://127.0.0.1:8000";
const HISTORY_KEY = "incidentlens_incidents";

let incidentInput;
let analyzeButton;
let loadingState;
let errorState;
let errorMessage;
let resultsSection;
let characterCount;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    initializeElements();
    initializeEvents();
    updateCharacterCount();
    checkBackend();
});

// ============================================================
// ELEMENTS
// ============================================================

function initializeElements() {

    incidentInput =
        document.querySelector("#incidentInput");

    analyzeButton =
        document.querySelector("#analyzeButton");

    loadingState =
        document.querySelector("#loadingState");

    errorState =
        document.querySelector("#errorState");

    errorMessage =
        document.querySelector("#errorMessage");

    resultsSection =
        document.querySelector("#resultsSection");

    characterCount =
        document.querySelector("#characterCount");
}

// ============================================================
// EVENTS
// ============================================================

function initializeEvents() {

    if (incidentInput) {

        incidentInput.addEventListener(
            "input",
            updateCharacterCount
        );

        incidentInput.addEventListener(
            "keydown",
            (event) => {

                if (
                    event.ctrlKey &&
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    analyzeIncident();
                }
            }
        );
    }

    if (analyzeButton) {

        analyzeButton.addEventListener(
            "click",
            analyzeIncident
        );
    }

    const clearButton =
        document.querySelector("#clearButton");

    if (clearButton) {

        clearButton.addEventListener(
            "click",
            clearIncident
        );
    }

    const historyNav =
        document.querySelector("#historyNav");

    if (historyNav) {

        historyNav.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                showView("history");
            }
        );
    }

    const statusNav =
        document.querySelector("#statusNav");

    if (statusNav) {

        statusNav.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                showView("status");
            }
        );
    }

    const analyzerNav =
        document.querySelector(
            ".nav-item:not(#historyNav):not(#statusNav)"
        );

    if (analyzerNav) {

        analyzerNav.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                showView("analyzer");
            }
        );
    }
}

// ============================================================
// CHARACTER COUNT
// ============================================================

function updateCharacterCount() {

    if (!incidentInput || !characterCount) {
        return;
    }

    characterCount.textContent =
        incidentInput.value.length;
}

// ============================================================
// BACKEND HEALTH
// ============================================================

async function checkBackend() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/health`
            );

        if (!response.ok) {

            throw new Error(
                `Backend returned ${response.status}`
            );
        }

        const data =
            await response.json();

        updateSystemStatus(
            true,
            data.model_loaded
        );

    } catch (error) {

        console.warn(
            "Backend connection unavailable:",
            error
        );

        updateSystemStatus(
            false,
            false
        );
    }
}

// ============================================================
// SYSTEM STATUS INDICATOR
// ============================================================

function updateSystemStatus(
    isOnline,
    modelLoaded
) {

    const status =
        document.querySelector(
            ".system-status"
        );

    if (!status) {
        return;
    }

    const dot =
        status.querySelector(
            ".system-status-dot"
        );

    if (dot) {

        dot.style.background =
            isOnline
                ? "var(--green)"
                : "var(--red)";
    }

    const textNode =
        [...status.childNodes]
            .find(
                node =>
                    node.nodeType === Node.TEXT_NODE &&
                    node.textContent.trim()
            );

    if (textNode) {

        textNode.textContent =
            isOnline
                ? modelLoaded
                    ? " LOCAL SYSTEM ONLINE"
                    : " LOCAL SYSTEM READY"
                : " LOCAL SYSTEM OFFLINE";
    }
}

// ============================================================
// ANALYZE INCIDENT
// ============================================================

async function analyzeIncident() {

    if (!incidentInput) {
        return;
    }

    const incidentText =
        incidentInput.value.trim();

    if (!incidentText) {

        showError(
            "Enter an incident description before analysis."
        );

        incidentInput.focus();

        return;
    }

    if (incidentText.length < 10) {

        showError(
            "Provide a little more detail about the incident."
        );

        incidentInput.focus();

        return;
    }

    setLoading(true);
    clearError();

    try {

        const response =
            await fetch(
                `${API_URL}/api/analyze`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        incident: incidentText
                    })
                }
            );

        if (!response.ok) {

            let message =
                `Server error (${response.status})`;

            try {

                const errorData =
                    await response.json();

                if (errorData.detail) {
                    message =
                        errorData.detail;
                }

                if (errorData.error) {
                    message =
                        errorData.error;
                }

            } catch (_) {}

            throw new Error(message);
        }

        const data =
            await response.json();

        if (!data.success) {

            throw new Error(
                data.error ||
                "The analysis could not be completed."
            );
        }

        if (!data.analysis) {

            throw new Error(
                "The backend returned an empty analysis."
            );
        }

        displayResult(
            data.analysis
        );

        saveIncident(
            incidentText,
            data.analysis
        );

    } catch (error) {

        console.error(
            "Analysis error:",
            error
        );

        showError(
            `Analysis failed: ${error.message}`
        );

    } finally {

        setLoading(false);
    }
}

// ============================================================
// DISPLAY RESULT
// ============================================================

function displayResult(result) {

    if (!resultsSection) {
        return;
    }

    const parsed =
        parseIncidentReport(result);

    const severityElement =
        document.querySelector(
            "#severityResult"
        );

    const symptomsElement =
        document.querySelector(
            "#symptomsResult"
        );

    const rootCausesElement =
        document.querySelector(
            "#rootCausesResult"
        );

    const actionsElement =
        document.querySelector(
            "#actionsResult"
        );

    const summaryElement =
        document.querySelector(
            "#summaryResult"
        );

    if (severityElement) {

        severityElement.textContent =
            parsed.severity || "Unknown";

        severityElement.className =
            `severity-value ${normalizeSeverity(
                parsed.severity
            )}`;
    }

    if (symptomsElement) {

        symptomsElement.innerHTML =
            formatList(
                parsed.symptoms
            );
    }

    if (rootCausesElement) {

        rootCausesElement.innerHTML =
            formatList(
                parsed.rootCauses,
                true
            );
    }

    if (actionsElement) {

        actionsElement.innerHTML =
            formatList(
                parsed.actions
            );
    }

    if (summaryElement) {

        summaryElement.textContent =
            parsed.summary || "—";
    }

    resultsSection.classList.remove(
        "hidden"
    );

    setTimeout(() => {

        resultsSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }, 100);
}

// ============================================================
// PARSE AI REPORT
// ============================================================

function parseIncidentReport(text) {

    const clean =
        text
            .replace(
                /<think>[\s\S]*?<\/think>/gi,
                ""
            )
            .replace(
                /```/g,
                ""
            )
            .trim();

    const sectionRegex =
        /^\s*(1\.|2\.|3\.|4\.|5\.)\s*(Severity|Observed Symptoms|Possible Root Causes|Initial Response Recommendations|Short Incident Summary)\s*:?\s*$/gim;

    const matches =
        [...clean.matchAll(sectionRegex)];

    const sections = {

        severity: "",

        symptoms: [],

        rootCauses: [],

        actions: [],

        summary: ""
    };

    if (!matches.length) {

        sections.summary =
            clean;

        return sections;
    }

    for (
        let i = 0;
        i < matches.length;
        i++
    ) {

        const current =
            matches[i];

        const start =
            current.index +
            current[0].length;

        const end =
            i + 1 < matches.length
                ? matches[i + 1].index
                : clean.length;

        const title =
            current[2].toLowerCase();

        const content =
            clean
                .slice(start, end)
                .trim();

        if (
            title === "severity"
        ) {

            sections.severity =
                extractSeverity(
                    content
                );

        } else if (
            title === "observed symptoms"
        ) {

            sections.symptoms =
                extractBullets(
                    content
                );

        } else if (
            title === "possible root causes"
        ) {

            sections.rootCauses =
                extractBullets(
                    content
                );

        } else if (
            title ===
            "initial response recommendations"
        ) {

            sections.actions =
                extractBullets(
                    content
                );

        } else if (
            title ===
            "short incident summary"
        ) {

            sections.summary =
                cleanInline(
                    content
                );
        }
    }

    return sections;
}

// ============================================================
// EXTRACT SEVERITY
// ============================================================

function extractSeverity(text) {

    const lines =
        text
            .split("\n")
            .map(cleanInline)
            .filter(Boolean);

    if (!lines.length) {
        return "";
    }

    const severityLine =
        lines.find(
            line =>
                /critical|high|medium|low/i
                    .test(line)
        );

    return (
        severityLine ||
        lines[0]
    );
}

// ============================================================
// EXTRACT BULLETS
// ============================================================

function extractBullets(text) {

    return text
        .split("\n")
        .map(
            line =>
                line
                    .trim()
                    .replace(
                        /^[-*•]\s*/,
                        ""
                    )
                    .replace(
                        /^\d+[.)]\s*/,
                        ""
                    )
                    .trim()
        )
        .filter(Boolean);
}

// ============================================================
// CLEAN INLINE TEXT
// ============================================================

function cleanInline(text) {

    return text
        .replace(
            /\*\*/g,
            ""
        )
        .replace(
            /^[-*•]\s*/,
            ""
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}

// ============================================================
// FORMAT LIST
// ============================================================

function formatList(
    items,
    possible = false
) {

    if (
        !items ||
        !items.length
    ) {

        return `
            <div class="empty-result">
                No information available.
            </div>
        `;
    }

    return `
        <ul>
            ${items
                .map(
                    item => `
                        <li>
                            <span>
                                ${escapeHTML(item)}
                            </span>

                            ${
                                possible
                                    ? `
                                        <span class="possible">
                                            POSSIBLE
                                        </span>
                                    `
                                    : ""
                            }
                        </li>
                    `
                )
                .join("")}
        </ul>
    `;
}

// ============================================================
// LOADING
// ============================================================

function setLoading(
    isLoading
) {

    if (loadingState) {

        loadingState.classList.toggle(
            "hidden",
            !isLoading
        );
    }

    if (!analyzeButton) {
        return;
    }

    const buttonText =
        analyzeButton.querySelector(
            "span:last-child"
        );

    if (isLoading) {

        analyzeButton.disabled =
            true;

        analyzeButton.classList.add(
            "loading"
        );

        if (buttonText) {

            buttonText.textContent =
                "Analyzing...";
        }

    } else {

        analyzeButton.disabled =
            false;

        analyzeButton.classList.remove(
            "loading"
        );

        if (buttonText) {

            buttonText.textContent =
                "Analyze Incident";
        }
    }
}

// ============================================================
// ERROR
// ============================================================

function showError(
    message
) {

    if (
        !errorState ||
        !errorMessage
    ) {
        return;
    }

    errorMessage.textContent =
        message;

    errorState.classList.remove(
        "hidden"
    );
}

function clearError() {

    if (!errorState) {
        return;
    }

    errorState.classList.add(
        "hidden"
    );
}

// ============================================================
// CLEAR ANALYZER
// ============================================================

function clearIncident() {

    if (incidentInput) {

        incidentInput.value = "";

        incidentInput.focus();
    }

    if (resultsSection) {

        resultsSection.classList.add(
            "hidden"
        );
    }

    clearError();
    updateCharacterCount();
}

// ============================================================
// INCIDENT HISTORY
// ============================================================

function getHistory() {

    try {

        return JSON.parse(
            localStorage.getItem(
                HISTORY_KEY
            ) || "[]"
        );

    } catch (_) {

        return [];
    }
}

function saveIncident(
    incidentText,
    analysis
) {

    const parsed =
        parseIncidentReport(
            analysis
        );

    const incidents =
        getHistory();

    const incident = {

        id:
            `INC-${String(
                Date.now()
            ).slice(-6)}`,

        text:
            incidentText,

        analysis:
            analysis,

        severity:
            parsed.severity ||
            "Unknown",

        createdAt:
            new Date().toISOString()
    };

    incidents.unshift(
        incident
    );

    localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(
            incidents.slice(0, 50)
        )
    );
}

// ============================================================
// VIEW MANAGEMENT
// ============================================================

function showView(
    view
) {

    const analyzerSections = [

        document.querySelector(
            ".hero"
        ),

        document.querySelector(
            ".incident-workspace"
        ),

        document.querySelector(
            "#loadingState"
        ),

        document.querySelector(
            "#errorState"
        ),

        document.querySelector(
            "#resultsSection"
        )
    ];

    const footer =
        document.querySelector(
            ".main-footer"
        );

    let dynamicView =
        document.querySelector(
            "#dynamicView"
        );

    if (!dynamicView) {

        dynamicView =
            document.createElement(
                "div"
            );

        dynamicView.id =
            "dynamicView";

        dynamicView.className =
            "view-panel";

        const wrapper =
            document.querySelector(
                ".content-wrapper"
            );

        if (wrapper) {

            wrapper.prepend(
                dynamicView
            );
        }
    }

    analyzerSections.forEach(
        section => {

            if (section) {

                section.classList.toggle(
                    "hidden",
                    view !== "analyzer"
                );
            }
        }
    );

    if (footer) {

        footer.classList.toggle(
            "hidden",
            view !== "analyzer"
        );
    }

    document
        .querySelectorAll(
            ".nav-item"
        )
        .forEach(
            item =>
                item.classList.remove(
                    "active"
                )
        );

    if (view === "analyzer") {

        document
            .querySelector(
                ".nav-item:not(#historyNav):not(#statusNav)"
            )
            ?.classList.add(
                "active"
            );

        dynamicView.innerHTML =
            "";

        dynamicView.classList.add(
            "hidden"
        );

        updateBreadcrumb(
            "ANALYZER"
        );

        return;
    }

    dynamicView.classList.remove(
        "hidden"
    );

    if (view === "history") {

        document
            .querySelector(
                "#historyNav"
            )
            ?.classList.add(
                "active"
            );

        updateBreadcrumb(
            "AI INCIDENTS"
        );

        renderHistory();
    }

    if (view === "status") {

        document
            .querySelector(
                "#statusNav"
            )
            ?.classList.add(
                "active"
            );

        updateBreadcrumb(
            "SYSTEM STATUS"
        );

        renderSystemStatus();
    }
}

// ============================================================
// BREADCRUMB
// ============================================================

function updateBreadcrumb(
    current
) {

    const element =
        document.querySelector(
            ".breadcrumb-current"
        );

    if (element) {

        element.textContent =
            current;
    }
}

// ============================================================
// AI INCIDENTS
// ============================================================

function renderHistory() {

    const dynamicView =
        document.querySelector(
            "#dynamicView"
        );

    if (!dynamicView) {
        return;
    }

    const incidents =
        getHistory();

    dynamicView.innerHTML = `

        <div class="view-panel-header">

            <div>

                <div class="view-panel-eyebrow">
                    INCIDENT MEMORY
                </div>

                <h1 class="view-panel-title">
                    AI Incidents
                </h1>

                <p class="view-panel-description">
                    Review locally stored incident analyses generated by IncidentLens AI.
                </p>

            </div>

            ${
                incidents.length
                    ? `
                        <button
                            class="history-clear-button"
                            id="clearHistoryButton"
                            type="button"
                        >
                            CLEAR HISTORY
                        </button>
                    `
                    : ""
            }

        </div>

        <div
            class="incident-list"
            id="incidentList"
        ></div>
    `;

    const list =
        dynamicView.querySelector(
            "#incidentList"
        );

    if (!incidents.length) {

        list.innerHTML = `

            <div class="incident-list-empty">

                <div class="incident-list-empty-icon">
                    ◈
                </div>

                <div class="incident-list-empty-title">
                    No incidents recorded
                </div>

                <div class="incident-list-empty-text">
                    Analyze an incident from the Analyzer workspace.
                    Completed reports will appear here automatically.
                </div>

            </div>
        `;

        return;
    }

    list.innerHTML =
        incidents
            .map(
                incident => {

                    const severityClass =
                        normalizeSeverity(
                            incident.severity
                        );

                    return `

                        <button
                            class="incident-row"
                            data-incident-id="${escapeHTML(
                                incident.id
                            )}"
                            type="button"
                        >

                            <div class="incident-id">
                                ${escapeHTML(
                                    incident.id
                                )}
                            </div>

                            <div class="incident-preview">

                                <div class="incident-preview-title">
                                    ${escapeHTML(
                                        incident.text
                                            .slice(
                                                0,
                                                110
                                            )
                                    )}
                                </div>

                                <div class="incident-preview-meta">
                                    LOCAL ANALYSIS
                                </div>

                            </div>

                            <div
                                class="incident-severity ${severityClass}"
                            >
                                ${escapeHTML(
                                    incident.severity
                                        .toUpperCase()
                                )}
                            </div>

                            <div class="incident-time">
                                ${formatDate(
                                    incident.createdAt
                                )}
                            </div>

                            <div class="incident-open">
                                →
                            </div>

                        </button>
                    `;
                }
            )
            .join("");

    list
        .querySelectorAll(
            ".incident-row"
        )
        .forEach(
            row => {

                row.addEventListener(
                    "click",
                    () => {

                        showIncidentDetail(
                            row.dataset
                                .incidentId
                        );
                    }
                );
            }
        );

    const clearButton =
        dynamicView.querySelector(
            "#clearHistoryButton"
        );

    if (clearButton) {

        clearButton.addEventListener(
            "click",
            () => {

                localStorage.removeItem(
                    HISTORY_KEY
                );

                renderHistory();
            }
        );
    }
}

// ============================================================
// INCIDENT DETAIL
// ============================================================

function showIncidentDetail(
    id
) {

    const incident =
        getHistory()
            .find(
                item =>
                    item.id === id
            );

    if (!incident) {
        return;
    }

    const dynamicView =
        document.querySelector(
            "#dynamicView"
        );

    if (!dynamicView) {
        return;
    }

    const parsed =
        parseIncidentReport(
            incident.analysis
        );

    dynamicView.innerHTML = `

        <div class="incident-detail">

            <button
                class="incident-detail-back"
                id="backToHistory"
                type="button"
            >
                ← BACK TO AI INCIDENTS
            </button>

            <div class="view-panel-eyebrow">
                INCIDENT REPORT
            </div>

            <h1 class="incident-detail-title">
                ${escapeHTML(
                    incident.id
                )}
            </h1>

            <div class="incident-detail-time">
                ${formatDate(
                    incident.createdAt
                )}
            </div>

            <div class="incident-detail-report">

                ${formatReportForHistory(
                    parsed
                )}

            </div>

        </div>
    `;

    dynamicView
        .querySelector(
            "#backToHistory"
        )
        ?.addEventListener(
            "click",
            renderHistory
        );
}

// ============================================================
// HISTORY REPORT
// ============================================================

function formatReportForHistory(
    parsed
) {

    return `

        <article class="severity-panel">

            <div class="severity-left">

                <div class="result-eyebrow">
                    SEVERITY ASSESSMENT
                </div>

                <div class="severity-value ${normalizeSeverity(
                    parsed.severity
                )}">
                    ${escapeHTML(
                        parsed.severity ||
                        "Unknown"
                    )}
                </div>

                <div class="severity-description">
                    Estimated impact level based on the incident description.
                </div>

            </div>

        </article>

        <div class="analysis-grid">

            ${historyCard(
                "01",
                "OBSERVED",
                "Symptoms",
                parsed.symptoms
            )}

            ${historyCard(
                "02",
                "PROBABLE",
                "Root Causes",
                parsed.rootCauses,
                true
            )}

            ${historyCard(
                "03",
                "RECOMMENDED",
                "First Response",
                parsed.actions
            )}

        </div>

        <article class="summary-panel">

            <div class="summary-header">

                <div class="card-index">
                    04
                </div>

                <div>

                    <div class="card-eyebrow">
                        EXECUTIVE SIGNAL
                    </div>

                    <h3>
                        Incident Summary
                    </h3>

                </div>

            </div>

            <div class="summary-content">
                ${escapeHTML(
                    parsed.summary ||
                    "—"
                )}
            </div>

        </article>
    `;
}

// ============================================================
// HISTORY CARD
// ============================================================

function historyCard(
    index,
    eyebrow,
    title,
    items,
    possible = false
) {

    return `

        <article class="analysis-card">

            <div class="card-header">

                <div class="card-index">
                    ${index}
                </div>

                <div>

                    <div class="card-eyebrow">
                        ${eyebrow}
                    </div>

                    <h3>
                        ${title}
                    </h3>

                </div>

            </div>

            <div class="card-content">

                ${formatList(
                    items,
                    possible
                )}

            </div>

        </article>
    `;
}

// ============================================================
// SYSTEM STATUS
// ============================================================

async function renderSystemStatus() {

    const dynamicView =
        document.querySelector(
            "#dynamicView"
        );

    if (!dynamicView) {
        return;
    }

    dynamicView.innerHTML = `

        <div class="view-panel-header">

            <div>

                <div class="view-panel-eyebrow">
                    LOCAL INFRASTRUCTURE
                </div>

                <h1 class="view-panel-title">
                    System Status
                </h1>

                <p class="view-panel-description">
                    Live status information for the IncidentLens AI local runtime.
                </p>

            </div>

            <div
                class="view-status"
                id="overallStatus"
            >
                <span class="view-status-dot"></span>
                CHECKING
            </div>

        </div>

        <div class="status-grid">

            ${statusCard(
                "AI Engine",
                "Checking...",
                "Local inference service",
                "aiEngineStatus"
            )}

            ${statusCard(
                "API",
                "Checking...",
                "FastAPI backend",
                "apiStatus"
            )}

            ${statusCard(
                "Model",
                "Qwen 3.5 · 4B",
                "Local language model",
                "modelStatus"
            )}

            ${statusCard(
                "Runtime",
                "Foundry Local",
                "On-device model runtime",
                "runtimeStatus"
            )}

        </div>

        <div class="status-summary">

            <div class="status-summary-label">
                EXECUTION MODE
            </div>

            <div class="status-summary-value">
                Local inference — incident data stays on the local runtime.
            </div>

        </div>
    `;

    try {

        const response =
            await fetch(
                `${API_URL}/api/health`
            );

        if (!response.ok) {

            throw new Error(
                "API unavailable"
            );
        }

        const data =
            await response.json();

        setStatusCard(
            "apiStatus",
            "Operational",
            "Backend responding normally.",
            true
        );

        setStatusCard(
            "aiEngineStatus",
            data.model_loaded
                ? "Operational"
                : "Ready",
            data.model_loaded
                ? "Model loaded and ready for analysis."
                : "Model will load when analysis is requested.",
            true
        );

        setStatusCard(
            "modelStatus",
            data.model_loaded
                ? "Loaded"
                : "Available",
            data.model_loaded
                ? "Qwen 3.5 · 4B is loaded."
                : "Qwen 3.5 · 4B is available locally.",
            true
        );

        setStatusCard(
            "runtimeStatus",
            "Operational",
            "Foundry Local runtime detected.",
            true
        );

        const overall =
            document.querySelector(
                "#overallStatus"
            );

        if (overall) {

            overall.innerHTML = `
                <span class="view-status-dot"></span>
                OPERATIONAL
            `;
        }

    } catch (error) {

        setStatusCard(
            "apiStatus",
            "Offline",
            "Unable to reach the FastAPI backend.",
            false
        );

        setStatusCard(
            "aiEngineStatus",
            "Unavailable",
            "AI engine cannot be verified.",
            false
        );

        setStatusCard(
            "modelStatus",
            "Unknown",
            "Model status cannot be verified.",
            false
        );

        setStatusCard(
            "runtimeStatus",
            "Unknown",
            "Runtime status cannot be verified.",
            false
        );

        const overall =
            document.querySelector(
                "#overallStatus"
            );

        if (overall) {

            overall.style.color =
                "var(--red)";

            overall.style.background =
                "var(--red-soft)";

            overall.innerHTML = `
                <span class="view-status-dot"></span>
                DEGRADED
            `;
        }
    }
}

// ============================================================
// STATUS CARD
// ============================================================

function statusCard(
    title,
    value,
    detail,
    id
) {

    return `

        <article class="status-card">

            <div class="status-card-header">

                <div class="status-card-name">
                    ${title}
                </div>

                <div
                    class="status-pill"
                    id="${id}"
                >

                    <span class="status-pill-dot"></span>

                    CHECKING

                </div>

            </div>

            <div
                class="status-card-value"
                data-value="${id}"
            >
                ${value}
            </div>

            <div class="status-card-detail">
                ${detail}
            </div>

        </article>
    `;
}

// ============================================================
// UPDATE STATUS CARD
// ============================================================

function setStatusCard(
    id,
    value,
    detail,
    online
) {

    const pill =
        document.querySelector(
            `#${id}`
        );

    if (!pill) {
        return;
    }

    pill.classList.toggle(
        "offline",
        !online
    );

    pill.innerHTML = `

        <span class="status-pill-dot"></span>

        ${online
            ? "ONLINE"
            : "OFFLINE"
        }
    `;

    const valueElement =
        document.querySelector(
            `[data-value="${id}"]`
        );

    if (valueElement) {

        valueElement.textContent =
            value;
    }

    const card =
        pill.closest(
            ".status-card"
        );

    const detailElement =
        card?.querySelector(
            ".status-card-detail"
        );

    if (detailElement) {

        detailElement.textContent =
            detail;
    }
}

// ============================================================
// SEVERITY
// ============================================================

function normalizeSeverity(
    severity
) {

    const value =
        String(
            severity
        ).toLowerCase();

    if (
        value.includes(
            "critical"
        )
    ) {
        return "critical";
    }

    if (
        value.includes(
            "high"
        )
    ) {
        return "high";
    }

    if (
        value.includes(
            "medium"
        )
    ) {
        return "medium";
    }

    if (
        value.includes(
            "low"
        )
    ) {
        return "low";
    }

    return "medium";
}

// ============================================================
// DATE
// ============================================================

function formatDate(
    value
) {

    try {

        return new Intl.DateTimeFormat(
            "en-US",
            {
                dateStyle:
                    "medium",

                timeStyle:
                    "short"
            }
        ).format(
            new Date(value)
        );

    } catch (_) {

        return "Unknown time";
    }
}

// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHTML(
    text
) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        text ?? "";

    return div.innerHTML;
}

// ============================================================
// PUBLIC API
// ============================================================

window.IncidentLens = {

    analyzeIncident,

    clearIncident,

    checkBackend,

    showView
};

// ============================================================
// CONSOLE
// ============================================================

console.log(
    "%cIncidentLens AI",
    "font-size: 20px; font-weight: bold;"
);

console.log(
    "Frontend loaded successfully."
);