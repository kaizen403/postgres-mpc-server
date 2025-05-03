// prisma/seed.js

/**
 * Seed script (no faker) for simple food-delivery schema.
 *
 * Usage:
 *   npm install @prisma/client
 *   node prisma/seed.js
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Helper fns
const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomElement = (arr) => arr[randomInt(0, arr.length - 1)];

const generateEmail = (name) => {
  const clean = name.toLowerCase().replace(/[^a-z]/g, "");
  const domain = randomElement([
    "example.com",
    "mail.com",
    "test.org",
    "demo.net",
  ]);
  return `${clean}${randomInt(1, 99)}@${domain}`;
};

// Sample data pools
const firstNames = [
  "Alice",
  "Bob",
  "Carol",
  "Dave",
  "Eve",
  "Frank",
  "Grace",
  "Heidi",
  "Ivan",
  "Judy",
  "Mallory",
  "Oscar",
  "Peggy",
  "Trent",
  "Victor",
  "Wendy",
];
const lastNames = [
  "Smith",
  "Johnson",
  "Williams",
  "Jones",
  "Brown",
  "Davis",
  "Miller",
  "Wilson",
  "Moore",
  "Taylor",
  "Anderson",
];
const streets = [
  "Elm St",
  "Oak St",
  "Maple Ave",
  "Pine St",
  "Cedar Rd",
  "Birch Ln",
  "Walnut St",
  "Chestnut Ave",
  "Spruce Dr",
  "Aspen Way",
];
const cities = [
  "New York, NY",
  "Los Angeles, CA",
  "Chicago, IL",
  "Houston, TX",
  "Phoenix, AZ",
  "Philadelphia, PA",
  "San Antonio, TX",
  "San Diego, CA",
  "Dallas, TX",
  "San Jose, CA",
];
const restaurantSuffixes = [
  "Cafe",
  "Bistro",
  "Grill",
  "Diner",
  "Kitchen",
  "Eatery",
  "House",
  "Corner",
];
const foodItems = [
  "Margherita Pizza",
  "Cheeseburger",
  "Chicken Curry",
  "Caesar Salad",
  "Spaghetti Bolognese",
  "Veggie Tacos",
  "Sushi Roll",
  "Grilled Steak",
  "Tomato Soup",
  "Pancakes",
  "BBQ Ribs",
  "Fish & Chips",
  "Falafel Wrap",
  "Pad Thai",
  "Chocolate Cake",
];
const orderStatuses = ["PENDING", "CONFIRMED", "DELIVERED", "CANCELLED"];

async function main() {
  // Clear existing
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.user.deleteMany();

  // Create Users
  const users = [];
  for (let i = 0; i < 20; i++) {
    const name = `${randomElement(firstNames)} ${randomElement(lastNames)}`;
    const user = await prisma.user.create({
      data: {
        name,
        email: generateEmail(name),
      },
    });
    users.push(user);
  }
  console.log(`Created ${users.length} users`);

  // Create Restaurants
  const restaurants = [];
  for (let i = 0; i < 5; i++) {
    const name = `${randomElement(lastNames)} ${randomElement(restaurantSuffixes)}`;
    const address = `${randomInt(100, 999)} ${randomElement(streets)}, ${randomElement(cities)}`;
    const rest = await prisma.restaurant.create({
      data: { name, address },
    });
    restaurants.push(rest);
  }
  console.log(`Created ${restaurants.length} restaurants`);

  // Create MenuItems
  const menuItems = [];
  for (const rest of restaurants) {
    const count = randomInt(6, 12);
    for (let i = 0; i < count; i++) {
      const item = await prisma.menuItem.create({
        data: {
          restaurantId: rest.id,
          name: randomElement(foodItems),
          price: parseFloat((randomInt(500, 3000) / 100).toFixed(2)),
          available: Math.random() < 0.9,
        },
      });
      menuItems.push(item);
    }
  }
  console.log(`Created ${menuItems.length} menu items`);

  // Create Orders (with OrderItems)
  let orderCount = 0;
  for (let i = 0; i < 50; i++) {
    const user = randomElement(users);
    const rest = randomElement(restaurants);
    const itemsForRest = menuItems.filter((mi) => mi.restaurantId === rest.id);
    const numItems = randomInt(1, 5);

    // Build order items data
    let total = 0;
    const itemsData = [];
    for (let j = 0; j < numItems; j++) {
      const mi = randomElement(itemsForRest);
      const qty = randomInt(1, 3);
      const lineTotal = parseFloat((mi.price * qty).toFixed(2));
      total += lineTotal;
      itemsData.push({
        menuItemId: mi.id,
        quantity: qty,
        unitPrice: mi.price,
      });
    }

    await prisma.order.create({
      data: {
        userId: user.id,
        restaurantId: rest.id,
        total: parseFloat(total.toFixed(2)),
        status: randomElement(orderStatuses),
        placedAt: new Date(Date.now() - randomInt(0, 30) * 24 * 60 * 60 * 1000),
        items: { create: itemsData },
      },
    });
    orderCount++;
  }
  console.log(`Created ${orderCount} orders`);

  console.log("✅ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
