import { AuditLog, User } from './src/main/database/models.js';

async function run() {
  try {
    const { count, rows } = await AuditLog.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit: 200,
      offset: 0,
      include: [{ model: User, attributes: ['id', 'username', 'role', 'avatar'] }]
    });
    console.log("Success! Logs count:", count);
  } catch (err) {
    console.error("Sequelize Error:", err);
  }
}
run();
