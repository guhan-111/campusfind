require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

// ==================== MIDDLEWARE ====================

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  })
);

app.use(express.json());

// ==================== STUDENT MODEL ====================

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    studentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Student = mongoose.model("Student", studentSchema);

// ==================== ITEM MODEL ====================

const itemSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    type: {
      type: String,
      enum: ["lost", "found"],
      required: true,
    },

    itemName: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["active", "returned", "closed"],
      default: "active",
    },

    claimId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Claim",
      default: null,
    },
  },
  { timestamps: true }
);

const Item = mongoose.model("Item", itemSchema);

// ==================== CLAIM MODEL ====================

const claimSchema = new mongoose.Schema(
  {
    lostItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
    },

    foundItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
    },

    claimant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    finder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    finderAccepted: {
      type: Boolean,
      default: false,
    },

    ownerConfirmed: {
      type: Boolean,
      default: false,
    },

    finderConfirmed: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "closed", "rejected"],
      default: "pending",
    },

    closedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Claim = mongoose.model("Claim", claimSchema);

// ==================== AUTHENTICATION ====================

async function authenticateStudent(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Please log in to continue.",
      });
    }

    const token = authHeader.slice(7);

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const student = await Student.findById(
      decoded.studentId
    ).select("_id name studentId email");

    if (!student) {
      return res.status(401).json({
        message: "Student account not found.",
      });
    }

    req.student = student;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired session. Please log in again.",
    });
  }
}

// ==================== ROOT AND HEALTH ====================

app.get("/", (req, res) => {
  res.json({
    message: "CampusFind backend is running!",
    health: "/api/health",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    application: "CampusFind",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
  });
});

app.get("/api/test-items", (req, res) => {
  res.json({
    success: true,
    message: "CampusFind test route is working!",
  });
});

// ==================== REGISTER ====================

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, studentId, email, password } = req.body;

    if (
      !name?.trim() ||
      !studentId?.trim() ||
      !email?.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Please fill in all required fields.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedStudentId = studentId.trim();

    const existingStudent = await Student.findOne({
      $or: [
        { email: normalizedEmail },
        { studentId: normalizedStudentId },
      ],
    });

    if (existingStudent) {
      return res.status(409).json({
        message: "This email or student ID is already registered.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await Student.create({
      name: name.trim(),
      studentId: normalizedStudentId,
      email: normalizedEmail,
      password: hashedPassword,
    });

    return res.status(201).json({
      message: "Account created successfully! Please sign in.",
    });
  } catch (error) {
    console.error("Registration error:", error.message);

    return res.status(500).json({
      message: "Registration failed. Please try again.",
    });
  }
});

// ==================== LOGIN ====================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({
        message: "Enter your email and password.",
      });
    }

    const loginId = email.trim();

    const student = await Student.findOne({
      $or: [
        { email: loginId.toLowerCase() },
        { studentId: loginId },
      ],
    });

    if (!student) {
      return res.status(401).json({
        message: "Invalid email/Student ID or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      student.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email/Student ID or password.",
      });
    }

    const token = jwt.sign(
      { studentId: student._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.json({
      message: "Login successful!",
      token,
      student: {
        id: student._id.toString(),
        _id: student._id.toString(),
        name: student.name,
        studentId: student.studentId,
        email: student.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      message: "Login failed. Please try again.",
    });
  }
});

// ==================== RESTORE SESSION ====================

app.get("/api/auth/me", authenticateStudent, (req, res) => {
  return res.json({
    student: {
      id: req.student._id.toString(),
      _id: req.student._id.toString(),
      name: req.student.name,
      studentId: req.student.studentId,
      email: req.student.email,
    },
  });
});

// ==================== CREATE REPORT ====================

app.post("/api/items", authenticateStudent, async (req, res) => {
  try {
    const {
      type,
      itemName,
      category,
      location,
      description,
    } = req.body;

    if (!["lost", "found"].includes(type)) {
      return res.status(400).json({
        message: "Report type must be lost or found.",
      });
    }

    if (
      !itemName?.trim() ||
      !category?.trim() ||
      !location?.trim() ||
      !description?.trim()
    ) {
      return res.status(400).json({
        message: "Please fill in all report fields.",
      });
    }

    const item = await Item.create({
      owner: req.student._id,
      type,
      itemName: itemName.trim(),
      category: category.trim(),
      location: location.trim(),
      description: description.trim(),
    });

    return res.status(201).json({
      message: "Report saved successfully!",
      item,
    });
  } catch (error) {
    console.error("Create report error:", error.message);

    return res.status(500).json({
      message: "Unable to save the report.",
    });
  }
});

// ==================== GET ACTIVE REPORTS ====================

app.get("/api/items", authenticateStudent, async (req, res) => {
  try {
    const filter = {
      status: "active",
    };

    if (["lost", "found"].includes(req.query.type)) {
      filter.type = req.query.type;
    }

    const items = await Item.find(filter)
      .populate("owner", "name studentId")
      .sort({ createdAt: -1 });

    console.log("Active reports returned:", items.length);

    return res.json({ items });
  } catch (error) {
    console.error("Fetch reports error:", error.message);

    return res.status(500).json({
      message: "Unable to load reports.",
    });
  }
});

// ==================== MATCHING HELPERS ====================

function normalizeText(value = "") {
  return String(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function calculateSimilarity(valueA = "", valueB = "") {
  const a = normalizeText(valueA);
  const b = normalizeText(valueB);

  if (!a || !b) {
    return 0;
  }

  if (a === b) {
    return 1;
  }

  const wordsA = new Set(a.split(" ").filter(Boolean));
  const wordsB = new Set(b.split(" ").filter(Boolean));

  const commonWords = [...wordsA].filter((word) =>
    wordsB.has(word)
  );

  const unionWords = new Set([...wordsA, ...wordsB]);

  const wordScore = unionWords.size
    ? commonWords.length / unionWords.size
    : 0;

  const substringScore =
    a.includes(b) || b.includes(a) ? 0.8 : 0;

  return Math.max(wordScore, substringScore);
}

// ==================== FIND MATCHES ====================

app.get(
  "/api/items/:itemId/matches",
  authenticateStudent,
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.itemId)) {
        return res.status(400).json({
          message: "Invalid report ID.",
        });
      }

      const lostItem = await Item.findOne({
        _id: req.params.itemId,
        type: "lost",
        status: "active",
      });

      if (!lostItem) {
        return res.status(404).json({
          message: "Active lost report not found.",
        });
      }

      if (
        lostItem.owner.toString() !== req.student._id.toString()
      ) {
        return res.status(403).json({
          message: "Only the owner of this lost report can find matches.",
        });
      }

      const foundItems = await Item.find({
        type: "found",
        status: "active",
        owner: { $ne: lostItem.owner },
      })
        .populate("owner", "name studentId email")
        .sort({ createdAt: -1 });

      const matches = foundItems
        .map((foundItem) => {
          const nameScore = calculateSimilarity(
            lostItem.itemName,
            foundItem.itemName
          );

          const categoryScore = calculateSimilarity(
            lostItem.category,
            foundItem.category
          );

          const locationScore = calculateSimilarity(
            lostItem.location,
            foundItem.location
          );

          const descriptionScore = calculateSimilarity(
            lostItem.description,
            foundItem.description
          );

          const matchScore = Math.round(
            nameScore * 45 +
              categoryScore * 25 +
              locationScore * 20 +
              descriptionScore * 10
          );

          const matchReasons = [];

          if (nameScore > 0) {
            matchReasons.push("Similar item name");
          }

          if (categoryScore > 0) {
            matchReasons.push("Similar category");
          }

          if (locationScore > 0) {
            matchReasons.push("Similar location");
          }

          if (descriptionScore > 0) {
            matchReasons.push("Similar description");
          }

          return {
            item: foundItem,
            matchScore,
            matchReasons,
          };
        })
        .filter((match) => match.matchScore >= 15)
        .sort((a, b) => b.matchScore - a.matchScore);

      console.log("Lost report:", lostItem.itemName);
      console.log("Found reports checked:", foundItems.length);
      console.log(
        "Matches:",
        matches.map((match) => ({
          item: match.item.itemName,
          score: match.matchScore,
        }))
      );

      return res.json({
        lostItem,
        matches,
      });
    } catch (error) {
      console.error("Matching error:", error.message);

      return res.status(500).json({
        message: "Unable to find matching reports.",
      });
    }
  }
);

// ==================== CREATE CLAIM ====================

app.post(
  "/api/items/:lostItemId/claim",
  authenticateStudent,
  async (req, res) => {
    try {
      const { foundItemId } = req.body;

      if (
        !mongoose.isValidObjectId(req.params.lostItemId) ||
        !mongoose.isValidObjectId(foundItemId)
      ) {
        return res.status(400).json({
          message: "Invalid lost or found report ID.",
        });
      }

      const lostItem = await Item.findById(req.params.lostItemId);
      const foundItem = await Item.findById(foundItemId);

      if (!lostItem || !foundItem) {
        return res.status(404).json({
          message: "Lost or found report not found.",
        });
      }

      if (
        lostItem.type !== "lost" ||
        foundItem.type !== "found"
      ) {
        return res.status(400).json({
          message: "Select one lost report and one found report.",
        });
      }

      if (
        lostItem.owner.toString() !== req.student._id.toString()
      ) {
        return res.status(403).json({
          message: "Only the owner of the lost report can claim it.",
        });
      }

      if (
        lostItem.owner.toString() === foundItem.owner.toString()
      ) {
        return res.status(400).json({
          message: "You cannot claim your own found report.",
        });
      }

      if (
        lostItem.status !== "active" ||
        foundItem.status !== "active"
      ) {
        return res.status(409).json({
          message: "One or both reports are no longer active.",
        });
      }

      if (lostItem.claimId || foundItem.claimId) {
        return res.status(409).json({
          message: "A claim already exists for one of these reports.",
        });
      }

      const claim = await Claim.create({
        lostItem: lostItem._id,
        foundItem: foundItem._id,
        claimant: lostItem.owner,
        finder: foundItem.owner,
      });

      lostItem.claimId = claim._id;
      foundItem.claimId = claim._id;

      await Promise.all([
        lostItem.save(),
        foundItem.save(),
      ]);

      return res.status(201).json({
        message: "Claim submitted. Waiting for the finder to accept.",
        claim,
      });
    } catch (error) {
      console.error("Create claim error:", error.message);

      return res.status(500).json({
        message: "Unable to create the claim.",
      });
    }
  }
);

// ==================== GET MY CLAIMS ====================

app.get("/api/claims", authenticateStudent, async (req, res) => {
  try {
    const claims = await Claim.find({
      $or: [
        { claimant: req.student._id },
        { finder: req.student._id },
      ],
    })
      .populate({
        path: "lostItem",
        populate: {
          path: "owner",
          select: "name studentId",
        },
      })
      .populate({
        path: "foundItem",
        populate: {
          path: "owner",
          select: "name studentId",
        },
      })
      .sort({ createdAt: -1 });

    return res.json({ claims });
  } catch (error) {
    console.error("Fetch claims error:", error.message);

    return res.status(500).json({
      message: "Unable to load claims.",
    });
  }
});

// ==================== ACCEPT CLAIM ====================

app.post(
  "/api/claims/:claimId/accept",
  authenticateStudent,
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.claimId)) {
        return res.status(400).json({
          message: "Invalid claim ID.",
        });
      }

      const claim = await Claim.findById(req.params.claimId);

      if (!claim) {
        return res.status(404).json({
          message: "Claim not found.",
        });
      }

      if (claim.finder.toString() !== req.student._id.toString()) {
        return res.status(403).json({
          message: "Only the finder can accept this claim.",
        });
      }

      if (claim.status !== "pending") {
        return res.status(400).json({
          message: "This claim is no longer pending.",
        });
      }

      claim.finderAccepted = true;
      claim.status = "accepted";

      await claim.save();

      return res.json({
        message: "Claim accepted. Both students can confirm handover.",
        claim,
      });
    } catch (error) {
      console.error("Accept claim error:", error.message);

      return res.status(500).json({
        message: "Unable to accept the claim.",
      });
    }
  }
);

// ==================== CONFIRM HANDOVER ====================

async function confirmClaim(req, res, role) {
  try {
    if (!mongoose.isValidObjectId(req.params.claimId)) {
      return res.status(400).json({
        message: "Invalid claim ID.",
      });
    }

    const claim = await Claim.findById(req.params.claimId);

    if (!claim) {
      return res.status(404).json({
        message: "Claim not found.",
      });
    }

    const studentId = req.student._id.toString();

    if (
      role === "owner" &&
      claim.claimant.toString() !== studentId
    ) {
      return res.status(403).json({
        message: "Only the lost item owner can confirm receipt.",
      });
    }

    if (
      role === "finder" &&
      claim.finder.toString() !== studentId
    ) {
      return res.status(403).json({
        message: "Only the finder can confirm handover.",
      });
    }

    if (claim.status !== "accepted") {
      return res.status(400).json({
        message: "The finder must accept the claim first.",
      });
    }

    if (role === "owner") {
      if (claim.ownerConfirmed) {
        return res.status(400).json({
          message: "Receipt was already confirmed.",
        });
      }

      claim.ownerConfirmed = true;
    } else {
      if (claim.finderConfirmed) {
        return res.status(400).json({
          message: "Handover was already confirmed.",
        });
      }

      claim.finderConfirmed = true;
    }

    if (claim.ownerConfirmed && claim.finderConfirmed) {
      const lostItem = await Item.findById(claim.lostItem);
      const foundItem = await Item.findById(claim.foundItem);

      if (!lostItem || !foundItem) {
        return res.status(404).json({
          message: "One of the reports could not be found.",
        });
      }

      if (
        lostItem.status !== "active" ||
        foundItem.status !== "active"
      ) {
        return res.status(409).json({
          message: "One or both reports are no longer active.",
        });
      }

      lostItem.status = "closed";
      foundItem.status = "closed";

      claim.status = "closed";
      claim.closedAt = new Date();

      await Promise.all([
        lostItem.save(),
        foundItem.save(),
        claim.save(),
      ]);

      return res.json({
        message: "Both students confirmed. Both reports are now closed.",
        claim,
      });
    }

    await claim.save();

    return res.json({
      message:
        role === "owner"
          ? "Receipt confirmed. Waiting for finder confirmation."
          : "Handover confirmed. Waiting for owner confirmation.",
      claim,
    });
  } catch (error) {
    console.error("Confirm claim error:", error.message);

    return res.status(500).json({
      message: "Unable to confirm the claim.",
    });
  }
}

app.post(
  "/api/claims/:claimId/confirm-owner",
  authenticateStudent,
  (req, res) => confirmClaim(req, res, "owner")
);

app.post(
  "/api/claims/:claimId/confirm-finder",
  authenticateStudent,
  (req, res) => confirmClaim(req, res, "finder")
);

// ==================== REJECT CLAIM ====================

app.post(
  "/api/claims/:claimId/reject",
  authenticateStudent,
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.claimId)) {
        return res.status(400).json({
          message: "Invalid claim ID.",
        });
      }

      const claim = await Claim.findById(req.params.claimId);

      if (!claim) {
        return res.status(404).json({
          message: "Claim not found.",
        });
      }

      if (claim.finder.toString() !== req.student._id.toString()) {
        return res.status(403).json({
          message: "Only the finder can reject this claim.",
        });
      }

      if (claim.status !== "pending") {
        return res.status(400).json({
          message: "Only pending claims can be rejected.",
        });
      }

      await Item.updateMany(
        {
          claimId: claim._id,
          status: "active",
        },
        {
          $set: { claimId: null },
        }
      );

      claim.status = "rejected";
      await claim.save();

      return res.json({
        message: "Claim rejected. Both reports are active again.",
        claim,
      });
    } catch (error) {
      console.error("Reject claim error:", error.message);

      return res.status(500).json({
        message: "Unable to reject the claim.",
      });
    }
  }
);

// ==================== START SERVER ====================

async function startServer() {
  try {
    if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
      throw new Error(
        "MONGODB_URI and JWT_SECRET must be set in server/.env"
      );
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully!");

    const port = process.env.PORT || 5000;

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`CampusFind backend running on port ${PORT}`);
    });
    } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();