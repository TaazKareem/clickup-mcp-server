import dotenv from 'dotenv';
import { config } from 'process';

// Load environment variables from .env file
dotenv.config();

console.log('Environment variables received:', {
  CLICKUP_API_KEY: process.env.CLICKUP_API_KEY,
  TEAM_ID: process.env.TEAM_ID
});

interface Config {
  clickupApiKey: string;
  teamId: string;
}

// Parse command line arguments for --env flags
const args = process.argv.slice(2);
console.log('Command line arguments:', args);

const envArgs: { [key: string]: string } = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--env' && i + 1 < args.length) {
    const [key, value] = args[i + 1].split('=');
    if (key === 'CLICKUP_API_KEY') envArgs.clickupApiKey = value;
    if (key === 'TEAM_ID') envArgs.teamId = value;
    i++; // Skip the next argument since we used it
  }
}

console.log('Parsed environment arguments:', envArgs);

const configuration: Config = {
  clickupApiKey: envArgs.clickupApiKey || process.env.CLICKUP_API_KEY || '',
  teamId: envArgs.teamId || process.env.TEAM_ID || ''
};

console.log('Final configuration:', configuration);

// Check for missing environment variables
const missingEnvVars = Object.entries(configuration)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}`
  );
}

export default configuration; 