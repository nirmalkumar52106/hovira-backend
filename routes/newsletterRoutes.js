const express = require("express");
const router = express.Router();

const {
  subscribeNewsletter,
  unsubscribeNewsletter,
} = require("../controllers/newsletterController");

router.post("/subscribe", subscribeNewsletter);

router.get("/unsubscribe/:token", unsubscribeNewsletter);

module.exports = router;