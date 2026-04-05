import { config } from "dotenv";

config({ path: ".env.local" });

async function createAdmin() {
  const email = "suwijak@sakornguard.com";
  const password = "admin123"; // Change this to a secure password
  const name = "Suwijak";

  console.log("Creating admin user...");
  console.log("Email:", email);
  console.log("Password:", password);

  try {
    const response = await fetch(
      `${process.env.BETTER_AUTH_URL}/api/auth/sign-up/email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: process.env.BETTER_AUTH_URL!,
        },
        body: JSON.stringify({
          email,
          password,
          name,
        }),
      },
    );

    const text = await response.text();
    console.log("Response status:", response.status);
    console.log("Response body:", text);

    if (!response.ok) {
      throw new Error(
        `Failed to create admin user: ${response.status} ${text}`,
      );
    }

    const data = text ? JSON.parse(text) : {};

    console.log("✅ Admin user created successfully!");
    console.log("You can now login with:");
    console.log("  Email:", email);
    console.log("  Password:", password);
  } catch (error) {
    console.error("❌ Failed to create admin user:", error);
    process.exit(1);
  }
}

createAdmin();
