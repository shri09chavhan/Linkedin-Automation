let currentStatus = {
    running: false,
    step: "idle",
    message: "Ready",
    updatedAt: new Date().toISOString()
};

const setStatus = (step, message, extra = {}) => {
    currentStatus = {
        ...currentStatus,
        ...extra,
        step,
        message,
        updatedAt: new Date().toISOString()
    };

    console.log(`[status] ${step}: ${message}`);
};

const startRun = () => {
    setStatus("starting", "Starting automation", { running: true });
};

const finishRun = (message) => {
    setStatus("finished", message, { running: false });
};

const failRun = (message) => {
    setStatus("failed", message, { running: false });
};

const getStatus = () => currentStatus;

module.exports = {
    setStatus,
    startRun,
    finishRun,
    failRun,
    getStatus
};
