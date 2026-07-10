const { generateToken } = require('../../utils/auth');

const authHeader = (user) => ({
  Authorization: `Bearer ${generateToken(user)}`
});

module.exports = { authHeader };
