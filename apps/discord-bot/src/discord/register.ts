import dotenv from "dotenv";
import { commands } from "../commands";

dotenv.config({ path: [".dev.vars"] });
const env = process.env;

function getRequiredEnv(name: "DISCORD_APPLICATION_ID" | "DISCORD_TOKEN") {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

const main = async () => {
  const applicationId = getRequiredEnv("DISCORD_APPLICATION_ID");
  const token = getRequiredEnv("DISCORD_TOKEN");

  const commandDefinitions = Array.from(commands.values()).map((cmd) => cmd.definition);

  const response = await fetch(
    `https://discord.com/api/v10/applications/${applicationId}/commands`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commandDefinitions),
    }
  );

  if (!response.ok) {
    console.error(`Failed to register commands: ${response.status}`);
    const error = await response.text();
    console.error(error);
  } else {
    console.log("Commands registered successfully");
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  }
};

main().catch(console.error);
