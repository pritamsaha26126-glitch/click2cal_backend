import { rekognition } from "../config/aws.config.js";
import { SmartWeightEstimator } from "./smart-estimation.service.js";

export const detectImageLabels = async (imageBuffer) => {
  const params = {
    Image: { Bytes: imageBuffer },
    MaxLabels: 20,
    MinConfidence: 70,
  };

  const response = await rekognition.detectLabels(params).promise();
  return response.Labels;
};

export const extractFoodItemsGeneric = (labels, confidenceThreshold = 75) => {
  const ignore = new Set([
    "Food",
    "Fruit",
    "Produce",
    "Plant",
    "Dish",
    "Meal",
    "Plate",
    "Bowl",
    "Cuisine",
    "Food Presentation",
    "Kitchen",
    "Kitchen and Dining",
    "Tableware",
    "Cutlery",
    "Fork",
    "Spoon",
    "Knife",
    "Seafood",
    "Vegetable",
  ]);

  return labels.filter(
    (label) =>
      label.Confidence >= confidenceThreshold &&
      !ignore.has(label.Name) &&
      (label.Categories?.some((c) => c.Name === "Food and Beverage") ||
        label.Parents?.some((p) => p.Name === "Food")),
  );
};

export const estimateFoodQuantitySmart = async (
  foodLabels,
  allLabels,
  imageBuffer,
) => {
  const quantities = {};

  const imageContext = SmartWeightEstimator.analyzeImageContext(allLabels);
  imageContext.totalFoodItems = foodLabels.length;

  for (const label of foodLabels) {
    try {
      const estimation = await SmartWeightEstimator.estimateWeight(
        label,
        imageBuffer,
        imageContext,
      );

      quantities[label.Name] = estimation;
    } catch (error) {
      console.error(`Error estimating ${label.Name}:`, error);

      quantities[label.Name] = {
        grams: 150,
        confidence: "low",
        breakdown: {
          base: 150,
          bboxFactor: 1,
          categoryFactor: 1,
          contextFactor: 1,
          imageFactor: 1,
        },
      };
    }
  }

  return quantities;
};
