const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
require("dotenv").config();

const jobRoutes = require("./routes/jobRoutes");
const emailRoutes = require("./routes/emailRoutes");
const statusService = require("./services/statusService");
const emailService = require("./services/emailService");

const app = express();
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: allowedOrigins
}));
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/jobs/status", (req, res) => {
    res.json(statusService.getStatus());
});

app.get("/api/status", (req, res) => {
    res.json(statusService.getStatus());
});

app.use("/api/email", emailRoutes);
app.use("/api/jobs", jobRoutes);

app.get("/", (req, res) => {
    res.json({
        status: "ok",
        message: "LinkedIn automation backend running"
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        aiEnabled: Boolean(process.env.GEMINI_API_KEY),
        emailConfigured: emailService.isEmailConfigured()
    });
});

const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
