require("dotenv").config();
const { Product, ProductVariant, User } = require("../api/entity");
const sequelize = require("../api/db");

async function fixUrls() {
    console.log("Starting URL fix script...");

    // Pattern to look for and replace
    const oldPart = "https://glorypos.com/api/uploads/";
    const newPart = "https://api.glorypos.com/uploads/";

    const updateValue = (val) => {
        if (typeof val === 'string' && val.includes(oldPart)) {
            return val.replace(oldPart, newPart);
        }
        return val;
    };

    const updateArray = (arr) => {
        if (Array.isArray(arr)) {
            return arr.map(img => updateValue(img));
        }
        return arr;
    };

    try {
        console.log("Updating Products...");
        const products = await Product.findAll();
        let productCount = 0;
        for (const product of products) {
            let updated = false;

            const newProductImage = updateValue(product.productImage);
            if (newProductImage !== product.productImage) {
                product.productImage = newProductImage;
                updated = true;
            }

            // Handle images array (JSON field)
            if (product.images) {
                const newImages = updateArray(product.images);
                if (JSON.stringify(newImages) !== JSON.stringify(product.images)) {
                    product.images = newImages;
                    updated = true;
                }
            }

            if (updated) {
                await product.save();
                productCount++;
            }
        }
        console.log(`Updated ${productCount} Products.`);

        console.log("Updating Product Variants...");
        const variants = await ProductVariant.findAll();
        let variantCount = 0;
        for (const variant of variants) {
            let updated = false;

            const newImageUrl = updateValue(variant.imageUrl);
            if (newImageUrl !== variant.imageUrl) {
                variant.imageUrl = newImageUrl;
                updated = true;
            }

            if (variant.images) {
                const newImages = updateArray(variant.images);
                if (JSON.stringify(newImages) !== JSON.stringify(variant.images)) {
                    variant.images = newImages;
                    updated = true;
                }
            }

            if (updated) {
                await variant.save();
                variantCount++;
            }
        }
        console.log(`Updated ${variantCount} Product Variants.`);

        console.log("Updating Users...");
        const users = await User.findAll();
        let userCount = 0;
        for (const user of users) {
            const newImage = updateValue(user.image);
            if (newImage !== user.image) {
                user.image = newImage;
                await user.save();
                userCount++;
            }
        }
        console.log(`Updated ${userCount} Users.`);

        console.log("\nSuccess: Image URL fix completed!");
    } catch (error) {
        console.error("Error during URL fix:", error);
    } finally {
        await sequelize.close();
    }
}

fixUrls();
