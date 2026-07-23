require('dotenv').config();

const requiredEnv = ['MONGODB_URI', 'SESSION_SECRET'];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length > 0) {
  console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const connectDB = require('./config/db');
connectDB();

if (process.env.NODE_ENV !== 'test' && process.env.ENABLE_CRON !== 'false') {
  require('./jobs/scheduler')();
}

const app = require('./app');
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`NdalamaHub server is running on port ${PORT}`);
});
