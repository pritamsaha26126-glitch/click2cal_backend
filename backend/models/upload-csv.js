import mongoose from "mongoose";
import fs from "fs";
import csv from "csv-parser";
import dotenv from "dotenv";

dotenv.config();

const Food = mongoose.model(
  "macros",
  new mongoose.Schema({
    SlNo: String,
    category: String,
    subCategory: String,
    name: String,
    calories: Number,
    protein: Number,
    fat: Number,
    carbs: Number,
  }),
);
export default Food;
async function uploadCSV() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    console.log("Clearing existing data...");
    await Food.deleteMany({});

    const foods = [];
    let rowCount = 0;

    await new Promise((resolve, reject) => {
      fs.createReadStream("./data/Food_Nutrition_Database_1000.csv")
        .pipe(csv())
        .on("data", (row) => {
          rowCount++;

          if (rowCount <= 3) {
            console.log(`Row ${rowCount}:`, row);
            console.log(`Row ${rowCount} keys:`, Object.keys(row));
          }

          const foodItem = {
            SlNo: row.Index | "",
            category: (row.Category || "").trim(),
            subCategory: (row.SubCategory || "").trim(),
            name: (row["Food Item"] || "").toLowerCase().trim(),
            calories: parseFloat(row["Calories (kcal)"]) || 0,
            protein: parseFloat(row["Protein (g)"]) || 0,
            fat: parseFloat(row["Fat (g)"]) || 0,
            carbs: parseFloat(row["Carbs (g)"]) || 0,
          };

          foods.push(foodItem);

          if (rowCount % 100 === 0) {
            process.stdout.write(`Processed ${rowCount} rows...\r`);
          }
        })
        .on("end", () => {
          console.log(`\nFinished reading ${rowCount} rows`);
          resolve();
        })
        .on("error", reject);
    });

    console.log(`Found ${foods.length} valid food items`);

    console.log("Inserting data...");
    await Food.insertMany(foods);

    console.log(`Successfully inserted ${foods.length} items`);

    await Food.collection.createIndex({
      name: "text",
      category: "text",
      subCategory: "text",
    });
    console.log("Created text index");

    const totalCount = await Food.countDocuments();
    console.log(`Total documents in collection: ${totalCount}`);

    await mongoose.disconnect();
    console.log("Upload complete!");
  } catch (error) {
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);
  }
}

export { uploadCSV };
