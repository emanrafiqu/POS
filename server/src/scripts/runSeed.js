/**
 * CLI seeder: `npm run seed -- admin@veloura.pk MyPassword123 "Store Admin"`
 * Generates 50 products, 20 customers, 10 suppliers, 5 employees and 100 sales.
 */
import { seedDatabase } from '../services/seedService.js';

const [email, password, name] = process.argv.slice(2);

if (!email || !password || password.length < 8) {
  console.error('Usage: npm run seed -- <adminEmail> <adminPassword(8+ chars)> [adminName]');
  process.exit(1);
}

seedDatabase({ adminEmail: email, adminPassword: password, adminName: name || 'Store Admin' })
  .then((summary) => {
    console.log('✔ Seed complete:', summary);
    process.exit(0);
  })
  .catch((err) => {
    console.error('✖ Seed failed:', err);
    process.exit(1);
  });
