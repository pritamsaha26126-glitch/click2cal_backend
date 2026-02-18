import {
  detectImageLabels,
  extractFoodItemsGeneric,
  estimateFoodQuantitySmart,
} from "../services/rekognition.service.js";
import Food from "../models/upload-csv.js";
import UserProfile from "../models/user.model.js";
import DailyIntake from "../models/daily-intake.model.js";
import ScanHistory from "../models/scan-history.model.js";
import { uploadToS3 } from "../services/s3.service.js";

export const analyzeFoodImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Image required",
      });
    }

    const { userId, deviceType, location } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      });
    }

    const imageUrl = await uploadToS3(req.file.buffer, req.file.originalname);

    const allLabels = await detectImageLabels(req.file.buffer);
    const foodLabels = extractFoodItemsGeneric(allLabels);

    const quantities = await estimateFoodQuantitySmart(
      foodLabels,
      allLabels,
      req.file.buffer,
    );

    const items = [];
    for (const label of foodLabels) {
      const grams = quantities[label.Name]?.grams || 100;
      const confidence = label.Confidence || 0;

      const dbFood = await findFoodInDB(label.Name);

      if (dbFood) {
        const multiplier = grams / 100;

        items.push({
          food: label.Name,
          matchedItem: dbFood.name,
          category: dbFood.category,
          subCategory: dbFood.subCategory,
          grams: grams,
          calories: Math.round(dbFood.calories * multiplier),
          protein: Math.round(dbFood.protein * multiplier * 10) / 10,
          carbs: Math.round(dbFood.carbs * multiplier * 10) / 10,
          fat: Math.round(dbFood.fat * multiplier * 10) / 10,
          source: "database",
          confidence: confidence,
        });
      } else {
        items.push({
          food: label.Name,
          matchedItem: null,
          category: "Unknown",
          subCategory: "Unknown",
          grams: grams,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          source: "detected_only",
          confidence: confidence,
        });
      }
    }

    const totals = {
      calories: items.reduce((sum, i) => sum + i.calories, 0),
      protein:
        Math.round(items.reduce((sum, i) => sum + i.protein, 0) * 10) / 10,
      carbs: Math.round(items.reduce((sum, i) => sum + i.carbs, 0) * 10) / 10,
      fat: Math.round(items.reduce((sum, i) => sum + i.fat, 0) * 10) / 10,
    };

    const scanHistory = new ScanHistory({
      userId,
      imageUrl,
      imageName: req.file.originalname,
      detectedItems: items,
      totals,
      metadata: {
        deviceType: deviceType || "web",
        timestamp: new Date(),
      },
    });

    await scanHistory.save();

    res.json({
      success: true,
      scanId: scanHistory.scanId,
      items,
      totals,
      imageUrl,
      timestamp: scanHistory.createdAt,
      message: "Scan saved to history",
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

export const getScanHistory = async (req, res) => {
  try {
    const userId = req.query.userId;

    console.log("Received userId:", userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      });
    }

    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      startDate,
      endDate,
      search,
      category,
      addedToIntake,
      minCalories,
      maxCalories,
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build query object
    const query = { userId };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    if (addedToIntake !== undefined) {
      query.addedToDailyIntake = addedToIntake === "true";
    }

    if (minCalories || maxCalories) {
      query["totals.calories"] = {};
      if (minCalories) {
        query["totals.calories"].$gte = parseInt(minCalories, 10);
      }
      if (maxCalories) {
        query["totals.calories"].$lte = parseInt(maxCalories, 10);
      }
    }

    if (search) {
      query["detectedItems.food"] = { $regex: search, $options: "i" };
    }

    if (category) {
      query["detectedItems.category"] = { $regex: category, $options: "i" };
    }

    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const scans = await ScanHistory.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .select("-__v")
      .lean();

    const totalScans = await ScanHistory.countDocuments(query);
    const totalPages = Math.ceil(totalScans / limitNum);

    const summary = await ScanHistory.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalScans: { $sum: 1 },
          totalCaloriesScanned: { $sum: "$totals.calories" },
          avgCaloriesPerScan: { $avg: "$totals.calories" },
          scansAddedToIntake: {
            $sum: { $cond: ["$addedToDailyIntake", 1, 0] },
          },
          topCategories: {
            $push: "$detectedItems.category",
          },
        },
      },
    ]);

    let categoryStats = {};
    if (summary[0]?.topCategories) {
      const allCategories = summary[0].topCategories.flat();
      categoryStats = allCategories.reduce((acc, category) => {
        if (category) {
          acc[category] = (acc[category] || 0) + 1;
        }
        return acc;
      }, {});
    }

    const topCategories = Object.entries(categoryStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    res.json({
      success: true,
      data: {
        scans,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalItems: totalScans,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
        summary: {
          totalScans: summary[0]?.totalScans || 0,
          totalCaloriesScanned: summary[0]?.totalCaloriesScanned || 0,
          avgCaloriesPerScan: Math.round(summary[0]?.avgCaloriesPerScan || 0),
          scansAddedToIntake: summary[0]?.scansAddedToIntake || 0,
          topCategories,
        },
      },
    });
  } catch (error) {
    console.error("Get scan history error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getScanById = async (req, res) => {
  try {
    const userId = req.query.userId;
    const { scanId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      });
    }

    const scan = await ScanHistory.findOne({
      userId,
      scanId,
    }).lean();

    if (!scan) {
      return res.status(404).json({
        success: false,
        error: "Scan not found",
      });
    }

    res.json({
      success: true,
      data: scan,
    });
  } catch (error) {
    console.error("Get scan by ID error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const deleteScan = async (req, res) => {
  try {
    const { userId } = req.body;
    const { scanId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      });
    }

    const scan = await ScanHistory.findOneAndDelete({
      userId,
      scanId,
    });

    if (!scan) {
      return res.status(404).json({
        success: false,
        error: "Scan not found",
      });
    }

    res.json({
      success: true,
      message: "Scan deleted successfully",
      data: { scanId },
    });
  } catch (error) {
    console.error("Delete scan error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const addToDailyIntake = async (req, res) => {
  try {
    const { userId, date, calories, protein, carbs, fat, foodName, grams } =
      req.body;

    console.log("Add to daily intake - userId:", userId, "calories:", calories);

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      });
    }

    if (!calories && !protein && !carbs && !fat) {
      return res.status(400).json({
        success: false,
        error: "At least one nutrition value is required",
      });
    }

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

    let dailyIntake = await DailyIntake.findOne({
      userId,
      date: {
        $gte: targetDate,
        $lt: nextDay,
      },
    });

    const manualFoodItem = {
      foodName: foodName || "Manual Entry",
      category: "Manual",
      subCategory: "Manual",
      grams: grams || 100,
      calories: calories || 0,
      protein: protein || 0,
      carbs: carbs || 0,
      fat: fat || 0,
      source: "manual",
      confidence: 100,
      imageUrl: null,
    };

    if (dailyIntake) {
      dailyIntake.items.push(manualFoodItem);

      dailyIntake.totals = {
        calories: (dailyIntake.totals.calories || 0) + (calories || 0),
        protein: (dailyIntake.totals.protein || 0) + (protein || 0),
        carbs: (dailyIntake.totals.carbs || 0) + (carbs || 0),
        fat: (dailyIntake.totals.fat || 0) + (fat || 0),
      };

      dailyIntake.updatedAt = Date.now();
      await dailyIntake.save();
    } else {
      dailyIntake = new DailyIntake({
        userId,
        date: targetDate,
        items: [manualFoodItem],
        totals: {
          calories: calories || 0,
          protein: protein || 0,
          carbs: carbs || 0,
          fat: fat || 0,
        },
      });
      await dailyIntake.save();
    }

    const userProfile = await UserProfile.findOne({ userId });

    const remaining = {
      calories: Math.max(
        0,
        (userProfile?.dailyCalories || 2000) - dailyIntake.totals.calories,
      ),
      protein: Math.max(
        0,
        (userProfile?.dailyProtein || 0) - dailyIntake.totals.protein,
      ),
      carbs: Math.max(
        0,
        (userProfile?.dailyCarbs || 0) - dailyIntake.totals.carbs,
      ),
      fat: Math.max(0, (userProfile?.dailyFat || 0) - dailyIntake.totals.fat),
    };

    res.json({
      success: true,
      message: "Nutrition added to daily intake successfully",
      data: {
        intake: dailyIntake,
        totals: dailyIntake.totals,
        remaining,
        target: {
          calories: userProfile?.dailyCalories || 2000,
          protein: userProfile?.dailyProtein || 0,
          carbs: userProfile?.dailyCarbs || 0,
          fat: userProfile?.dailyFat || 0,
        },
      },
    });
  } catch (error) {
    console.error("Add to daily intake error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
export const getStats = async (req, res) => {
  try {
    const userId = req.query.userId;
    const { timeframe = "all" } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      });
    }

    let startDate = null;
    const now = new Date();

    switch (timeframe) {
      case "week":
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case "month":
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case "year":
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      case "all":
      default:
        startDate = null;
    }

    const query = { userId };
    if (startDate) {
      query.createdAt = { $gte: startDate };
    }

    const stats = await ScanHistory.aggregate([
      { $match: query },
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                totalScans: { $sum: 1 },
                totalItemsDetected: { $sum: { $size: "$detectedItems" } },
                totalCalories: { $sum: "$totals.calories" },
                avgCaloriesPerScan: { $avg: "$totals.calories" },
                addedToIntakeCount: {
                  $sum: { $cond: ["$addedToDailyIntake", 1, 0] },
                },
              },
            },
          ],
          dailyScans: [
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                },
                count: { $sum: 1 },
                totalCalories: { $sum: "$totals.calories" },
              },
            },
            { $sort: { _id: 1 } },
          ],
          topFoods: [
            { $unwind: "$detectedItems" },
            {
              $group: {
                _id: "$detectedItems.food",
                count: { $sum: 1 },
                avgGrams: { $avg: "$detectedItems.grams" },
                totalCalories: { $sum: "$detectedItems.calories" },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
          categories: [
            { $unwind: "$detectedItems" },
            {
              $group: {
                _id: "$detectedItems.category",
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
          ],
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0]?.overview[0] || {},
        dailyScans: stats[0]?.dailyScans || [],
        topFoods: stats[0]?.topFoods || [],
        categories: stats[0]?.categories || [],
      },
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getDailyIntake = async (req, res) => {
  try {
    const userId = req.query.userId;
    const { date } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      });
    }

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

    const dailyIntake = await DailyIntake.findOne({
      userId,
      date: {
        $gte: targetDate,
        $lt: nextDay,
      },
    });

    const userProfile = await UserProfile.findOne({ userId });

    // If dailyIntake exists, map items back to expected format
    let intakeData = dailyIntake;
    if (dailyIntake) {
      // Convert foodName back to food for frontend compatibility
      const mappedItems = dailyIntake.items.map((item) => ({
        food: item.foodName, // Map foodName back to food
        matchedItem: item.matchedItem,
        category: item.category,
        subCategory: item.subCategory,
        grams: item.grams,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        source: item.source,
        confidence: item.confidence,
        imageUrl: item.imageUrl,
      }));

      intakeData = {
        ...dailyIntake.toObject(),
        items: mappedItems,
      };
    } else {
      intakeData = {
        userId,
        date: targetDate,
        items: [],
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      };
    }

    const response = {
      success: true,
      data: {
        intake: intakeData,
        target: {
          calories: userProfile?.dailyCalories || 2000,
          protein: userProfile?.dailyProtein || 0,
          carbs: userProfile?.dailyCarbs || 0,
          fat: userProfile?.dailyFat || 0,
        },
      },
    };

    if (dailyIntake) {
      response.data.remaining = {
        calories: Math.max(
          0,
          (userProfile?.dailyCalories || 2000) - dailyIntake.totals.calories,
        ),
        protein: Math.max(
          0,
          (userProfile?.dailyProtein || 0) - dailyIntake.totals.protein,
        ),
        carbs: Math.max(
          0,
          (userProfile?.dailyCarbs || 0) - dailyIntake.totals.carbs,
        ),
        fat: Math.max(0, (userProfile?.dailyFat || 0) - dailyIntake.totals.fat),
      };
    } else {
      response.data.remaining = {
        calories: userProfile?.dailyCalories || 2000,
        protein: userProfile?.dailyProtein || 0,
        carbs: userProfile?.dailyCarbs || 0,
        fat: userProfile?.dailyFat || 0,
      };
    }

    res.json(response);
  } catch (error) {
    console.error("Get daily intake error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getWeeklyProgress = async (req, res) => {
  try {
    const userId = req.query.userId;
    const { startDate } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      });
    }

    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

    const weeklyIntake = await DailyIntake.find({
      userId,
      date: {
        $gte: start,
        $lt: end,
      },
    }).sort({ date: 1 });

    const userProfile = await UserProfile.findOne({ userId });

    const weeklyData = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = currentDate.toISOString().split("T")[0];

      const dayIntake = weeklyIntake.find(
        (intake) => intake.date.toISOString().split("T")[0] === dateStr,
      );

      weeklyData.push({
        date: dateStr,
        consumed: {
          calories: dayIntake?.totals.calories || 0,
          protein: dayIntake?.totals.protein || 0,
          carbs: dayIntake?.totals.carbs || 0,
          fat: dayIntake?.totals.fat || 0,
        },
        target: {
          calories: userProfile?.dailyCalories || 2000,
          protein: userProfile?.dailyProtein || 0,
          carbs: userProfile?.dailyCarbs || 0,
          fat: userProfile?.dailyFat || 0,
        },
      });
    }

    res.json({
      success: true,
      data: weeklyData,
      summary: {
        averageCalories: Math.round(
          weeklyData.reduce((sum, day) => sum + day.consumed.calories, 0) / 7,
        ),
        totalCalories: weeklyData.reduce(
          (sum, day) => sum + day.consumed.calories,
          0,
        ),
        goalAchievement: Math.round(
          (weeklyData.reduce((sum, day) => sum + day.consumed.calories, 0) /
            weeklyData.reduce((sum, day) => sum + day.target.calories, 0)) *
            100,
        ),
      },
    });
  } catch (error) {
    console.error("Get weekly progress error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const findFoodInDB = async (foodName) => {
  try {
    const searchTerm = foodName.toLowerCase().trim();

    const food = await Food.findOne({
      $or: [
        { name: { $regex: searchTerm, $options: "i" } },
        { subCategory: { $regex: searchTerm, $options: "i" } },
        { category: { $regex: searchTerm, $options: "i" } },
      ],
    });

    return food;
  } catch (error) {
    console.error("DB Search error:", error);
    return null;
  }
};
