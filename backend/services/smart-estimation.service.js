import { Jimp } from "jimp";

export class SmartWeightEstimator {
  static STANDARD_PORTIONS = {
    Chicken: 150,
    Meat: 150,
    Beef: 150,
    Mutton: 150,
    Lamb: 150,
    Fish: 150,
    Pork: 150,
    Egg: 50,
    Tofu: 100,
    Sausage: 80,
    Bacon: 30,
    Rice: 200,
    Pasta: 180,
    Bread: 30,
    Noodles: 180,
    Pizza: 250,
    Burger: 200,
    Sandwich: 150,
    Biryani: 300,
    Quinoa: 185,
    Oats: 40,
    Pancake: 80,
    Waffle: 75,
    Wrap: 180,

    Salad: 100,
    Broccoli: 80,
    Carrot: 60,
    Potato: 150,
    Tomato: 100,
    Onion: 70,
    Cucumber: 100,
    Corn: 90,
    Beans: 100,
    Lentils: 100,

    Apple: 180,
    Banana: 120,
    Orange: 130,
    Mango: 200,
    Strawberry: 15,
    Grapes: 100,
    Avocado: 150,

    Cheese: 30,
    Yogurt: 150,
    Milk: 250,
    Butter: 10,

    Soup: 250,
    Curry: 200,
    IceCream: 100,
    Cake: 100,
    Donut: 60,
    Chocolate: 40,
  };

  static FOOD_CATEGORIES = {
    light: ["Salad", "Cucumber", "Tomato", "Strawberry", "Lettuce", "Broccoli"],
    medium: ["Rice", "Pasta", "Bread", "Chicken", "Fish", "Potato", "Egg"],
    heavy: ["Pizza", "Burger", "Biryani", "Cheese", "Cake", "Beef", "Mutton"],
  };

  static async estimateWeight(label, imageBuffer, imageContext = {}) {
    const foodName = label.Name;
    const confidence = label.Confidence;
    const instances = label.Instances || [];

    let baseWeight = this.STANDARD_PORTIONS[foodName] || 150;

    const imageMetrics = await this.analyzeImageWithJimp(
      imageBuffer,
      instances,
    );

    let bboxMultiplier = 1;
    if (instances.length > 0) {
      bboxMultiplier = this.calculateBboxMultiplier(instances, imageMetrics);
    } else {
      bboxMultiplier = this.estimateFromConfidence(confidence, imageMetrics);
    }

    const categoryMultiplier = this.getCategoryMultiplier(foodName);

    const contextMultiplier = this.getContextMultiplier(imageContext);

    const imageQualityMultiplier = this.getImageQualityMultiplier(imageMetrics);

    const estimatedWeight = Math.round(
      baseWeight *
        bboxMultiplier *
        categoryMultiplier *
        contextMultiplier *
        imageQualityMultiplier,
    );

    const finalWeight = Math.max(20, Math.min(1000, estimatedWeight));

    return {
      grams: finalWeight,
      confidence: this.getEstimationConfidence(label, instances, imageMetrics),
      breakdown: {
        base: baseWeight,
        bboxFactor: bboxMultiplier.toFixed(2),
        categoryFactor: categoryMultiplier,
        contextFactor: contextMultiplier,
        imageFactor: imageQualityMultiplier.toFixed(2),
      },
    };
  }

  static async analyzeImageWithJimp(imageBuffer, instances = []) {
    try {
      const image = await Jimp.read(imageBuffer);

      const metrics = {
        width: image.bitmap.width,
        height: image.bitmap.height,
        totalPixels: image.bitmap.width * image.bitmap.height,
        brightness: 0,
        colorComplexity: 0,
        foodRegionBrightness: 0,
        aspectRatio: image.bitmap.width / image.bitmap.height,
      };

      let totalBrightness = 0;
      let pixelCount = 0;

      image.scan(
        0,
        0,
        image.bitmap.width,
        image.bitmap.height,
        function (x, y, idx) {
          if (x % 5 === 0 && y % 5 === 0) {
            const red = this.bitmap.data[idx + 0];
            const green = this.bitmap.data[idx + 1];
            const blue = this.bitmap.data[idx + 2];

            const brightness = 0.299 * red + 0.587 * green + 0.114 * blue;
            totalBrightness += brightness;
            pixelCount++;
          }
        },
      );

      metrics.brightness = totalBrightness / pixelCount;

      if (instances.length > 0) {
        metrics.foodRegionBrightness = await this.analyzeFoodRegion(
          image,
          instances[0].BoundingBox,
        );
      } else {
        metrics.foodRegionBrightness = metrics.brightness;
      }

      metrics.colorComplexity = await this.calculateColorComplexity(image);

      return metrics;
    } catch (error) {
      console.error("Jimp analysis error:", error);
      return {
        width: 1000,
        height: 1000,
        totalPixels: 1000000,
        brightness: 128,
        colorComplexity: 50,
        foodRegionBrightness: 128,
        aspectRatio: 1,
      };
    }
  }

  static async analyzeFoodRegion(image, boundingBox) {
    const x = Math.floor(boundingBox.Left * image.bitmap.width);
    const y = Math.floor(boundingBox.Top * image.bitmap.height);
    const width = Math.floor(boundingBox.Width * image.bitmap.width);
    const height = Math.floor(boundingBox.Height * image.bitmap.height);

    let regionBrightness = 0;
    let pixelCount = 0;

    const endX = Math.min(x + width, image.bitmap.width);
    const endY = Math.min(y + height, image.bitmap.height);

    image.scan(x, y, endX - x, endY - y, function (scanX, scanY, idx) {
      const red = this.bitmap.data[idx + 0];
      const green = this.bitmap.data[idx + 1];
      const blue = this.bitmap.data[idx + 2];

      const brightness = 0.299 * red + 0.587 * green + 0.114 * blue;
      regionBrightness += brightness;
      pixelCount++;
    });

    return pixelCount > 0 ? regionBrightness / pixelCount : 128;
  }

  static async calculateColorComplexity(image) {
    const colorBuckets = {};
    let sampleCount = 0;

    image.scan(
      0,
      0,
      image.bitmap.width,
      image.bitmap.height,
      function (x, y, idx) {
        if (x % 10 === 0 && y % 10 === 0) {
          const red = Math.floor(this.bitmap.data[idx + 0] / 32);
          const green = Math.floor(this.bitmap.data[idx + 1] / 32);
          const blue = Math.floor(this.bitmap.data[idx + 2] / 32);

          const colorKey = `${red}-${green}-${blue}`;
          colorBuckets[colorKey] = (colorBuckets[colorKey] || 0) + 1;
          sampleCount++;
        }
      },
    );

    const uniqueColors = Object.keys(colorBuckets).length;
    const complexity = (uniqueColors / sampleCount) * 100;

    return Math.min(100, complexity);
  }

  static calculateBboxMultiplier(instances, imageMetrics) {
    let totalArea = 0;

    instances.forEach((inst) => {
      const area = inst.BoundingBox.Width * inst.BoundingBox.Height;
      totalArea += area;
    });

    const instanceCount = instances.length;

    let areaMultiplier = 1;
    if (totalArea > 0.5) {
      areaMultiplier = 1.5;
    } else if (totalArea > 0.3) {
      areaMultiplier = 1.3;
    } else if (totalArea > 0.15) {
      areaMultiplier = 1.0;
    } else if (totalArea > 0.08) {
      areaMultiplier = 0.8;
    } else {
      areaMultiplier = 0.6;
    }

    return areaMultiplier * Math.min(instanceCount, 3);
  }

  static estimateFromConfidence(confidence, imageMetrics) {
    let multiplier = 1;

    if (confidence > 95) {
      multiplier = 1.3;
    } else if (confidence > 85) {
      multiplier = 1.1;
    } else if (confidence < 80) {
      multiplier = 0.9;
    }

    if (imageMetrics.brightness < 100) {
      multiplier *= 0.9;
    }

    return multiplier;
  }

  static getCategoryMultiplier(foodName) {
    if (this.FOOD_CATEGORIES.light.includes(foodName)) {
      return 0.8;
    } else if (this.FOOD_CATEGORIES.heavy.includes(foodName)) {
      return 1.2;
    }
    return 1.0;
  }

  static getContextMultiplier(imageContext) {
    let multiplier = 1;

    if (imageContext.hasPlate) {
      multiplier *= 1.1;
    }

    if (imageContext.totalFoodItems > 3) {
      multiplier *= 0.85;
    } else if (imageContext.totalFoodItems === 1) {
      multiplier *= 1.15;
    }

    if (imageContext.hasHand) {
      multiplier *= 1.05;
    }

    return multiplier;
  }

  static getImageQualityMultiplier(imageMetrics) {
    let multiplier = 1;

    if (imageMetrics.brightness < 80) {
      multiplier *= 0.95;
    } else if (imageMetrics.brightness > 200) {
      multiplier *= 0.95;
    }

    const megapixels = imageMetrics.totalPixels / 1000000;
    if (megapixels < 0.5) {
      multiplier *= 0.9;
    } else if (megapixels > 5) {
      multiplier *= 1.05;
    }

    return multiplier;
  }

  static getEstimationConfidence(label, instances, imageMetrics) {
    let score = 50;

    if (label.Confidence > 90) score += 20;
    else if (label.Confidence > 80) score += 10;
    else score += 5;

    if (instances.length > 0) score += 15;
    else score -= 10;

    if (imageMetrics.brightness > 100 && imageMetrics.brightness < 180) {
      score += 10;
    }

    const megapixels = imageMetrics.totalPixels / 1000000;
    if (megapixels > 2) score += 5;

    if (score >= 75) return "high";
    if (score >= 50) return "medium";
    return "low";
  }

  static analyzeImageContext(allLabels) {
    const context = {
      hasPlate: false,
      hasBowl: false,
      hasHand: false,
      hasCutlery: false,
      totalFoodItems: 0,
      setting: "unknown",
    };

    allLabels.forEach((label) => {
      const name = label.Name.toLowerCase();

      if (name.includes("plate") || name.includes("dish")) {
        context.hasPlate = true;
      }
      if (name.includes("bowl")) {
        context.hasBowl = true;
      }
      if (name.includes("hand") || name.includes("finger")) {
        context.hasHand = true;
      }
      if (
        name.includes("fork") ||
        name.includes("spoon") ||
        name.includes("knife")
      ) {
        context.hasCutlery = true;
      }
      if (name.includes("table") || name.includes("restaurant")) {
        context.setting = "restaurant";
      }
    });

    return context;
  }
}
