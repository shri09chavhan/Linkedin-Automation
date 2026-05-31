const express = require("express");
const router = express.Router();
const { startAutomation } = require("../controllers/jobController");

router.post("/apply", startAutomation);

module.exports = router;
