const router = require("express").Router();

const { protectAdmin } = require("../middleware/auth");

const {
  createCampaign,
  getCampaigns,
} = require("../controllers/newsletterCampaignController");

router.post("/", protectAdmin, createCampaign);

router.get("/", protectAdmin, getCampaigns);

module.exports = router;